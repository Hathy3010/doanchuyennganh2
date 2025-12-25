// DETAILED FRONTEND FLOW ANALYSIS
// - Responsibilities:
//   * loadDashboard(): GET /student/dashboard -> render schedule and attendance status
//   * handleCheckIn(classItem): request camera permission -> open face modal (verify mode)
//   * testCamera(): capture single frame, POST /detect-face-pose-and-expression -> show yaw/pitch/result
//   * startFaceVerification(): flip state isRecording -> begin frame capture loop
//   * frame capture loop (useEffect when isRecording && cameraReady):
//       - take picture (base64) ~ every 600-1000ms
//       - POST /detect-face-pose-and-expression with { image, current_action }
//       - If response.captured && response.action === expected_action:
//           -> push base64 into capturedFramesRef.current[action]
//       - When capturedFramesRef.current[action].length >= ACTION_SEQUENCE[index].target_frames:
//           -> advance currentActionIndex (or finish if last step)
//       - On finish: sendFramesToServer() -> POST /face/setup-frames { images: allBase64 }
//           -> handle response (success -> optionally call /attendance/checkin)
//   * sendFramesToServer(): POST /face/setup-frames -> on success inform user
//   * handleLogout(): POST /auth/logout then clear storage and redirect
//
// - State machine mapping:
//   * showFaceSetup: modal visible
//   * faceMode: 'setup' | 'verify' (controls copy + server route expectations)
//   * isRecording: capturing loop active
//   * currentActionIndex: index in ACTION_SEQUENCE; drives expected action id
//   * capturedFramesRef: accumulates images per action
//   * detectionMessage: user-facing real-time feedback from server results
//
// - Endpoints & expected exchanges:
//   GET /student/dashboard
//     -> { student_name, today_schedule: [...], total_classes_today, attended_today }
// 
//   POST /detect_face_pose_and_expression
//     body: { image: "<base64>", current_action: "neutral" }
//     -> { face_present: bool, yaw: number, pitch: number, action: "neutral", captured: bool, message: string, expression_detected?: string }
//     -> NOTE: this endpoint on the backend should call pose_detect.detect_face_pose_and_expression(...) to perform pose/expression detection.
// 
//   POST /face/setup-frames
//     body: { images: ["<base64>", ...] }
//     -> { success: true, saved_count: 12 } or error
//
//   POST /attendance/checkin
//     body: { student_id, class_id, location? }
//     -> { success: true, attendance_id, status }
//
// - UX notes:
//   * Show live detectionMessage to help user correct pose.
//   * Debounce/frame-rate limit camera captures to avoid overload.
//   * Show progress per action (target_frames) and total frames count.
//   * On network error: fallback to manual attendance flow or retry mechanism.
//

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl, Vibration } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { API_URL } from "../../config/api";
import RandomActionAttendanceModal from "../../components/RandomActionAttendanceModal";

interface ScheduleItem {
  class_id: string;
  class_name: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  room: string;
  attendance_status: string;
}

interface DashboardData {
  student_name: string;
  today_schedule: ScheduleItem[];
  total_classes_today: number;
  attended_today: number;
}

export default function StudentDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Setup Modal state
  const [showFaceSetupModal, setShowFaceSetupModal] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasFaceIDSetup, setHasFaceIDSetup] = useState(false);

  // Random Action Attendance Modal state
  const [showRandomActionModal, setShowRandomActionModal] = useState(false);
  const [currentClassItem, setCurrentClassItem] = useState<ScheduleItem | null>(null);

  // Setup sequence - 15 frames total
  const SETUP_SEQUENCE = [
    { id: 'neutral', instruction: 'Giữ khuôn mặt thẳng trong khung', duration: 3000, target_frames: 3 },
    { id: 'blink', instruction: 'Hãy chớp mắt tự nhiên', duration: 5000, target_frames: 2 },
    { id: 'mouth_open', instruction: 'Hãy mở miệng rộng ra', duration: 5000, target_frames: 2 },
    { id: 'micro_movement', instruction: 'Hãy nhúc nhích đầu nhẹ', duration: 8000, target_frames: 6 },
    { id: 'final_neutral', instruction: 'Giữ khuôn mặt thẳng', duration: 2000, target_frames: 2 }
  ];

  const [isRecording, setIsRecording] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [processingFace, setProcessingFace] = useState(false);
  const [faceMode, setFaceMode] = useState<'setup' | 'attendance'>('setup');
  const [poseDetected, setPoseDetected] = useState(false);


  const capturedFramesRef = useRef<{[key: string]: string[]}>({
    neutral: [], blink: [], mouth_open: [], micro_movement: [], final_neutral: []
  });

  const [detectionMessage, setDetectionMessage] = useState<string>('');

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  const resetFaceSetup = () => {
    setIsRecording(false);
    setCurrentActionIndex(0);
    capturedFramesRef.current = {
      neutral: [], blink: [], mouth_open: [], micro_movement: [], final_neutral: []
    };
    setDetectionMessage('');
  };

  const loadDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Load user profile to check Face ID setup
      try {
        const profileResponse = await fetch(`${API_URL}/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          // Only log when Face ID status changes
          if (profile.has_face_id !== hasFaceIDSetup) {
            console.log(`✅ Face ID setup status changed: ${profile.has_face_id}`);
          }
          setHasFaceIDSetup(profile.has_face_id);
        }
      } catch (error) {
        console.warn("Could not load profile:", error);
      }

      const response = await fetch(`${API_URL}/student/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 401) {
        await AsyncStorage.removeItem("access_token");
        router.replace("/login");
      } else {
        Alert.alert("Lỗi", "Không thể tải dữ liệu dashboard");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
    console.log("✅ Camera is READY and fully initialized");
  }, []);

  // Validate base64 sanity
  const isValidBase64 = (input: string | undefined | null) => {
    if (!input || typeof input !== "string") return false;
    let s = input.trim();
    const commaIdx = s.indexOf(',');
    if (s.startsWith('data:') && commaIdx !== -1) {
      s = s.slice(commaIdx + 1).trim();
    }
    s = s.replace(/\s+/g, '');
    if (s.length < 64) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false;
    return true;
  };

  const callDetectEndpoint = async (imageBase64: string, currentActionId: string) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) return { ok: false, reason: "no_token" };

    if (!isValidBase64(imageBase64)) {
      console.warn("callDetectEndpoint: invalid base64 image");
      return { ok: false, reason: "invalid_image" };
    }

    let cleanImageBase64 = imageBase64;
    const commaIdx = imageBase64.indexOf(',');
    if (imageBase64.startsWith('data:') && commaIdx !== -1) {
      cleanImageBase64 = imageBase64.slice(commaIdx + 1);
    }

    try {
      const res = await fetch(`${API_URL}/detect_face_pose_and_expression`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: cleanImageBase64,
          current_action: currentActionId,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, reason: txt || `status_${res.status}` };
      }

      const json = await res.json();
      return { ok: true, data: json };
    } catch (err) {
      console.warn("Error calling detect endpoint:", err);
      return { ok: false, reason: "network_error" };
    }
  };

  const validateCurrentPose = useCallback(async (imageBase64: string) => {
    try {
      const currentActionId = SETUP_SEQUENCE[currentActionIndex].id;
      console.log(`🔄 Validating pose for action: ${currentActionId}`);
      
      const result = await callDetectEndpoint(imageBase64, currentActionId);
      
      if (!result.ok) {
        console.error(`❌ Detect endpoint failed: ${result.reason}`);
        return { 
          facePresent: false, 
          yaw: 0, 
          pitch: 0, 
          message: `❌ ${result.reason === 'invalid_image' ? 'Ảnh không hợp lệ' : 'Lỗi server'}`,
          captured: false,
          action: null
        };
      }

      const res = result.data;
      console.log(`✅ Detection result:`, res);
      return {
        facePresent: Boolean(res.face_present),
        yaw: Number(res.yaw) || 0,
        pitch: Number(res.pitch) || 0,
        message: res.message || '🔍 Đang phát hiện...',
        expression_detected: res.expression_detected,
        captured: res.captured,
        action: res.action
      };
    } catch (error) {
      console.error("❌ Face detection error:", error);
      return { 
        facePresent: false, 
        yaw: 0, 
        pitch: 0, 
        message: `❌ Lỗi kết nối: ${error instanceof Error ? error.message : 'unknown'}`,
        captured: false,
        action: null
      };
    }
  }, [currentActionIndex, SETUP_SEQUENCE]);

  // Test camera function - captures single frame and validates
  const testCamera = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) {
      Alert.alert("Camera chưa sẵn sàng", "Vui lòng chờ camera khởi động...");
      return;
    }

    setIsTestingCamera(true);
    try {
      console.log("🧪 Testing camera...");
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.base64 || !isValidBase64(photo.base64)) {
        throw new Error("Ảnh chụp hỏng hoặc không hợp lệ");
      }

      const detection = await validateCurrentPose(photo.base64);

      if (detection.facePresent) {
        Alert.alert(
          "✅ TEST THÀNH CÔNG",
          `Khuôn mặt: Yaw ${detection.yaw.toFixed(1)}°, Pitch ${detection.pitch.toFixed(1)}°\n${detection.message}`
        );
      } else {
        Alert.alert("❌ TEST THẤT BẠI", detection.message || "Không phát hiện khuôn mặt - hãy nhìn vào camera");
      }
    } catch (error) {
      console.error("❌ TEST CAMERA ERROR:", error);
      Alert.alert("Lỗi test camera", error instanceof Error ? error.message : "Không thể chụp ảnh");
    } finally {
      setIsTestingCamera(false);
    }
  }, [cameraReady, validateCurrentPose]);

const handlePoseDetectedCapture = useCallback(async (forceCapture = false) => {
  if (!cameraRef.current || processingFace) return;

  if (faceMode === 'setup' && !poseDetected && !forceCapture) {
    console.log("⚠️ Cannot capture - pose not detected correctly");
    Alert.alert("Thông báo", "Vui lòng giữ vị trí khuôn mặt đúng hướng để có thể chụp ảnh.");
    return;
  }

  try {
    const poseInstruction = faceMode === 'setup' ? 'Circular Motion' : 'Front';
    console.log(`📸 Capturing face for: ${poseInstruction}`);

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7,
      base64: true,
      skipProcessing: true,
    });

    if (!photo?.base64 || !isValidBase64(photo.base64)) {
      throw new Error("Ảnh chụp hỏng hoặc không hợp lệ");
    }

    const detection = await validateCurrentPose(photo.base64);

    if (detection.facePresent) {
      Alert.alert(
        "✅ TEST THÀNH CÔNG",
        `Khuôn mặt: Yaw ${detection.yaw.toFixed(1)}°, Pitch ${detection.pitch.toFixed(1)}°`
      );
    } else {
      Alert.alert("❌ TEST THẤT BẠI", "Không phát hiện khuôn mặt - hãy nhìn vào camera");
    }
  } catch (error) {
    console.error("❌ TEST CAMERA ERROR:", error);
    Alert.alert("Lỗi test camera", error instanceof Error ? error.message : "Không thể chụp ảnh");
  } finally {
    setIsTestingCamera(false);
  }
}, [cameraReady, validateCurrentPose]);

  // Logic chụp frames real-time cho SETUP MODAL (15 frames)
  useEffect(() => {
    if (!showFaceSetupModal || !cameraReady || !cameraRef.current || !isRecording) return;

    const frameInterval = setInterval(async () => {
      try {
        if (!cameraRef.current) {
          console.warn("Camera ref not available");
          return;
        }

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          base64: true,
          skipProcessing: false,
        });

        if (!photo?.base64) {
          console.warn("⚠️ Empty photo.base64; skipping frame");
          setDetectionMessage("❌ Không lấy được ảnh");
          return;
        }

        const base64Size = photo.base64.length;
        console.log(`📸 Setup frame: ${base64Size} bytes`);

        if (!isValidBase64(photo.base64)) {
          console.warn("⚠️ Captured frame is invalid base64");
          setDetectionMessage("❌ Ảnh bị hỏng");
          return;
        }

        const detection = await validateCurrentPose(photo.base64);

        setDetectionMessage(detection.message || '🔍 Phát hiện...');

        if (detection.captured && detection.action && photo.base64) {
          const currentAction = SETUP_SEQUENCE[currentActionIndex];

          if (detection.action === currentAction.id) {
            capturedFramesRef.current[detection.action].push(photo.base64);

            const frameCount = capturedFramesRef.current[detection.action].length;
            console.log(`✅ ${detection.action}: ${frameCount}/${currentAction.target_frames} frames captured`);

            if (frameCount >= currentAction.target_frames) {
              console.log(`✨ Action '${detection.action}' completed! Moving to next action...`);
              
              if (currentActionIndex < SETUP_SEQUENCE.length - 1) {
                setCurrentActionIndex(prev => prev + 1);
                Vibration.vibrate(100);
                setDetectionMessage(`✅ Hoàn tất bước ${currentActionIndex + 1}`);
              } else {
                console.log("🎉 All setup actions completed! Sending frames to server...");
                setDetectionMessage("📤 Đang gửi dữ liệu...");
                await sendFramesToServerSetup();
                resetFaceSetup();
                setShowFaceSetupModal(false);
                Alert.alert("✅ Thành công", "Thiết lập FaceID hoàn tất!");
                // Refresh dashboard to update Face ID status
                await loadDashboard();
              }
            }
          }
        }
      } catch (err) {
        console.error("❌ Frame processing error:", err);
        setDetectionMessage(`❌ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 1000);

    return () => {
      clearInterval(frameInterval);
    };
  }, [showFaceSetupModal, cameraReady, isRecording, currentActionIndex, validateCurrentPose, SETUP_SEQUENCE, loadDashboard]);

  const sendFramesToServerSetup = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const allFrames = Object.values(capturedFramesRef.current).flat();
      
      console.log("📤 Sending frames breakdown:");
      Object.entries(capturedFramesRef.current).forEach(([action, frames]) => {
        console.log(`  ${action}: ${frames.length} frames`);
      });
      console.log(`📤 Total frames: ${allFrames.length}`);

      const response = await fetch(`${API_URL}/student/setup-faceid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          images: allFrames,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error:", response.status, errorText);
        throw new Error(`Lỗi gửi frames: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Server response:", result);
    } catch (error) {
      console.error("❌ Upload error:", error);

      if (error instanceof Error) {
        Alert.alert("Lỗi", `Không thể gửi dữ liệu: ${error.message}`);
      } else {
        Alert.alert("Lỗi", "Không thể gửi dữ liệu (unknown error)");
      }
    }
  };

  const startFaceVerification = () => {
    if (!cameraReady) {
      Alert.alert("Camera chưa sẵn sàng", "Vui lòng chờ...");
      return;
    }
    setIsRecording(true);
    setCurrentActionIndex(0);
    setDetectionMessage('Bắt đầu: Giữ mặt thẳng...');
    Vibration.vibrate(100);
  };

  const handleCheckIn = async (classItem: ScheduleItem) => {
    // Check if Face ID is set up first
    if (!hasFaceIDSetup) {
      Alert.alert(
        "Chưa thiết lập Face ID",
        "Bạn cần thiết lập Face ID trước khi điểm danh. Bạn có muốn thiết lập ngay không?",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Thiết lập", onPress: handleSetupFaceID }
        ]
      );
      return;
    }

    // Open Face ID verification modal for attendance
    setCurrentClassItem(classItem);
    setShowRandomActionModal(true);
  };

  // Simple check-in without face verification (for testing/fallback)
  const handleSimpleCheckIn = async (classItem: ScheduleItem) => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Lỗi", "Chưa đăng nhập");
        return;
      }

      // Get GPS location (using VKU default for now)
      const latitude = 16.0544;
      const longitude = 108.2022;

      // Call check-in API
      const response = await fetch(`${API_URL}/student/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          class_id: classItem.class_id,
          latitude,
          longitude,
        })
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert("✅ Thành công", "Điểm danh thành công!");
        // Refresh dashboard
        await loadDashboard();
      } else if (response.status === 400) {
        const error = await response.json();
        Alert.alert("Lỗi", error.detail || "Không thể điểm danh");
      } else {
        Alert.alert("Lỗi", "Lỗi server");
      }
    } catch (error) {
      console.error("Check-in error:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến server");
    }
  };

  const handleSetupFaceID = async () => {
    // Check and request camera permission
    let currentPermission = permission;
    
    if (!currentPermission?.granted) {
      console.log("📹 Camera permission not granted, requesting...");
      const permResult = await requestPermission();
      console.log("📹 Permission request result:", permResult.status);
      
      if (permResult.status !== 'granted') {
        Alert.alert("Cần quyền Camera", "Vui lòng cấp quyền camera để thiết lập Face ID");
        return;
      }
      currentPermission = permResult;
    }

    console.log("✅ Camera permission granted, opening setup modal");
    setShowFaceSetupModal(true);
    resetFaceSetup();
  };

  const cancelFaceSetup = () => {
    setShowFaceSetupModal(false);
    resetFaceSetup();
  };

  const handleRandomActionCheckInSuccess = () => {
    setShowRandomActionModal(false);
    loadDashboard();
  };

  const handleRandomActionCheckInClose = () => {
    setShowRandomActionModal(false);
  };

  const handleLogout = async () => {
    const token = await AsyncStorage.getItem("access_token");
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    await AsyncStorage.removeItem("access_token");
    await AsyncStorage.removeItem("user_role");
    router.replace("/login");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleClassPress = (item: ScheduleItem) => {
    router.push({
      pathname: "/class-detail",
      params: { classId: item.class_id, className: item.class_name }
    });
  };

  if (loading || !dashboardData) {
    return (
      <View style={styles.center}>
        <Text>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.welcome}>Xin chào, {dashboardData.student_name}!</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        {/* Face ID Setup Banner - Show only if not set up */}
        {!hasFaceIDSetup && (
          <View style={styles.setupFaceIDBanner}>
            <Text style={styles.setupBannerText}>⚠️ Bạn chưa thiết lập Face ID</Text>
            <Text style={styles.setupBannerDescription}>
              Thiết lập Face ID để có thể điểm danh nhanh chóng và an toàn
            </Text>
            <TouchableOpacity 
              style={styles.setupFaceIDButton} 
              onPress={handleSetupFaceID}
            >
              <Text style={styles.setupFaceIDButtonText}>🔐 Thiết lập ngay</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardData.total_classes_today}</Text>
            <Text style={styles.statLabel}>Môn học hôm nay</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardData.attended_today}</Text>
            <Text style={styles.statLabel}>Đã điểm danh</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thời khóa biểu hôm nay</Text>

        {dashboardData.today_schedule.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Không có môn học nào hôm nay</Text>
          </View>
        ) : (
          dashboardData.today_schedule.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.classCard}
              onPress={() => handleClassPress(item)}
            >
              <View style={styles.classHeader}>
                <Text style={styles.className}>{item.class_name}</Text>
                <Text style={styles.room}>Phòng {item.room}</Text>
              </View>
              <Text style={styles.teacher}>GV: {item.teacher_name}</Text>
              <Text style={styles.time}>
                {item.start_time} - {item.end_time}
              </Text>
              <View style={styles.attendanceSection}>
                {item.attendance_status === "present" ? (
                  <Text style={[styles.statusBadge, styles.presentBadge]}>✓ Đã điểm danh</Text>
                ) : item.attendance_status === "pending_face_verification" ? (
                  <Text style={[styles.statusBadge, styles.pendingBadge]}>⏳ Chờ xác minh</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.checkInButton}
                    onPress={() => handleCheckIn(item)}
                  >
                    <Text style={styles.checkInText}>📍 Điểm danh</Text>
                  </TouchableOpacity>
                )}
              </View> 
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FaceID Setup Modal - 15 frames */}
      {showFaceSetupModal && (
        <View style={styles.faceSetupModal}>
          <View style={styles.faceSetupHeader}>
            <Text style={styles.faceSetupTitle}>Thiết lập FaceID</Text>
            <Text style={styles.faceSetupSubtitle}>Chụp 15 ảnh từ các góc độ khác nhau</Text>
          </View>

          <View style={styles.faceSetupContainer}>
            {/* Camera View - Full screen circular */}
            <View style={styles.cameraCircleContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.faceSetupCamera}
                facing="front"
                onCameraReady={onCameraReady}
              />
              <View style={styles.cameraMask}>
                <View style={styles.cameraMaskHole} />
              </View>
            </View>

            {/* Current Action Instruction */}
            <View style={styles.currentActionContainer}>
              <Text style={styles.currentActionText}>
                {SETUP_SEQUENCE[currentActionIndex]?.instruction || '✅ Hoàn thành'}
              </Text>
              <Text style={styles.actionProgressText}>
                Bước {currentActionIndex + 1}/{SETUP_SEQUENCE.length}
              </Text>
            </View>

            {/* Real-time Detection Status */}
            <Text style={styles.detectionText}>
              {detectionMessage || '🔍 Phát hiện...'}
            </Text>

            {/* Control Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.testCameraButton, isTestingCamera && styles.testCameraButtonDisabled]}
                onPress={testCamera}
                disabled={isTestingCamera || !cameraReady}
              >
                <Text style={styles.testCameraText}>
                  {isTestingCamera ? '🧪 Đang test...' : '🧪 Test Camera'}
                </Text>
              </TouchableOpacity>

              {!isRecording && (
                <TouchableOpacity style={styles.startButton} onPress={startFaceVerification}>
                  <Text style={styles.startButtonText}>BẮT ĐẦU</Text>
                </TouchableOpacity>
              )}

              {isRecording && (
                <TouchableOpacity style={styles.resetButton} onPress={resetFaceSetup}>
                  <Text style={styles.resetButtonText}>RESET</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.faceSetupCancelButton} onPress={cancelFaceSetup}>
            <Text style={styles.faceSetupCancelText}>✕ Đóng</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Random Action Attendance Modal */}
      {currentClassItem && (
        <RandomActionAttendanceModal
          visible={showRandomActionModal}
          classItem={currentClassItem}
          onClose={handleRandomActionCheckInClose}
          onSuccess={handleRandomActionCheckInSuccess}
        />
      )}
    </View>
  );
}
// Styles (giữ nguyên từ code của bạn, chỉ bổ sung một số)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  welcome: { fontSize: 20, fontWeight: "bold", color: "#333" },
  logoutButton: { padding: 8 },
  logoutText: { color: "#FF3B30", fontSize: 16 },
  statsContainer: { flexDirection: "row", padding: 20, gap: 15 },
  statCard: { flex: 1, backgroundColor: "white", borderRadius: 10, padding: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statNumber: { fontSize: 32, fontWeight: "bold", color: "#007AFF" },
  statLabel: { fontSize: 14, color: "#666", marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", padding: 20, paddingBottom: 10, color: "#333" },
  emptyState: { alignItems: "center", padding: 40 },
  emptyText: { fontSize: 16, color: "#666" },
  classCard: { backgroundColor: "white", marginHorizontal: 20, marginBottom: 15, borderRadius: 10, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  classHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  className: { fontSize: 18, fontWeight: "bold", color: "#333", flex: 1 },
  room: { fontSize: 14, color: "#666" },
  teacher: { fontSize: 16, color: "#666", marginBottom: 5 },
  time: { fontSize: 16, color: "#333", marginBottom: 15 },
  attendanceSection: { alignItems: "flex-end" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, fontSize: 14, fontWeight: "bold" },
  presentBadge: { backgroundColor: "#34C759", color: "white" },
  pendingBadge: { backgroundColor: "#FF9500", color: "white" },
  checkInButton: { backgroundColor: "#007AFF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  checkInText: { color: "white", fontSize: 16, fontWeight: "bold" },

  // Face Setup Modal
  faceSetupModal: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 1000 },
  faceSetupHeader: { padding: 20, paddingTop: 50, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center" },
  faceSetupTitle: { fontSize: 24, fontWeight: "bold", color: "white", marginBottom: 8 },
  faceSetupSubtitle: { fontSize: 16, color: "#ccc" },
  faceSetupContainer: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', padding: 20 },
  cameraCircleContainer: { width: 264, height: 264, borderRadius: 132, overflow: 'hidden', position: 'relative', alignSelf: 'center', marginBottom: 20 },
  faceSetupCamera: { flex: 1 },
  cameraMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  cameraMaskHole: { width: 250, height: 250, borderRadius: 125, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FFFFFF' },
  userInstructionsContainer: { backgroundColor: "#F8F9FA", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E9ECEF" },
  userInstructionsTitle: { fontSize: 16, fontWeight: "bold", color: "#007AFF", marginBottom: 12 },
  instructionList: { gap: 6 },
  instructionItem: { fontSize: 14, color: "#666", lineHeight: 20 },
  instructionItemCompleted: { color: "#28A745", textDecorationLine: "line-through" },
  instructionItemCurrent: { color: "#FF6B35", fontWeight: "bold" },
  expressionNote: { fontSize: 12, color: "#999", fontStyle: "italic", textAlign: "center", marginTop: 10 },
  detectionText: { fontSize: 16, color: "#FFD700", fontWeight: "bold", marginTop: 10, textAlign: "center" },
  faceSetupCancelButton: { alignItems: "center", padding: 20 },
  faceSetupCancelText: { color: "#FF3B30", fontSize: 16, fontWeight: "500" },
  attendanceCancelButton: { alignItems: "center", padding: 20 },
  attendanceCancelText: { color: "#FF3B30", fontSize: 16, fontWeight: "500" },
  startButton: { backgroundColor: "#28A745", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  startButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  resetButton: { backgroundColor: "#FF9500", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  resetButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  currentActionContainer: { backgroundColor: "#E3F2FD", borderRadius: 12, padding: 16, marginVertical: 12, alignItems: "center", borderLeftWidth: 4, borderLeftColor: "#007AFF" },
  currentActionText: { fontSize: 18, fontWeight: "bold", color: "#1976D2", textAlign: "center", marginBottom: 8 },
  actionProgressText: { fontSize: 14, color: "#0D47A1", fontWeight: "500" },
  buttonContainer: { flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 16, flexWrap: "wrap" },
  cameraHint: { color: "#888888", fontSize: 12, textAlign: "center", marginTop: 12, fontStyle: "italic" },
  
  // Attendance Modal
  attendanceModal: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 1000 },
  attendanceHeader: { padding: 20, paddingTop: 50, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center" },
  attendanceTitle: { fontSize: 24, fontWeight: "bold", color: "white", marginBottom: 8 },
  attendanceSubtitle: { fontSize: 16, color: "#ccc" },
  attendanceContainer: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  // Face ID Setup Banner
  setupFaceIDBanner: { backgroundColor: "#FFF3CD", marginHorizontal: 20, marginTop: 10, borderRadius: 10, padding: 16, borderLeftWidth: 4, borderLeftColor: "#FFC107" },
  setupBannerText: { fontSize: 16, fontWeight: "bold", color: "#856404", marginBottom: 8 },
  setupBannerDescription: { fontSize: 14, color: "#856404", marginBottom: 12 },
  setupFaceIDButton: { backgroundColor: "#007AFF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start" },
  setupFaceIDButtonText: { color: "white", fontSize: 14, fontWeight: "bold" },
  
  // Test Camera Button
  testCameraButton: { backgroundColor: "#6C757D", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  testCameraButtonDisabled: { backgroundColor: "#ADB5BD" },
  testCameraText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
});