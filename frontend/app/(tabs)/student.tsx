import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl, Vibration } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { API_URL } from "../../config/api";
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native';


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
  const [showFaceSetup, setShowFaceSetup] = useState(false);
  // New circular motion setup
  const [circularProgress, setCircularProgress] = useState(0); // 0-100
  const [capturedAngles, setCapturedAngles] = useState<Set<number>>(new Set()); // Track captured angles
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  // Face ID style pose diversity
  const [collectedAngles, setCollectedAngles] = useState<Array<{yaw: number, pitch: number, timestamp: number}>>([]);
  const [requiredFrames] = useState(30); // Collect 30 frames for pose diversity
  const [processingFace, setProcessingFace] = useState(false);
  const [faceMode, setFaceMode] = useState<'setup' | 'verify'>('setup');
  const [currentClassItem, setCurrentClassItem] = useState<ScheduleItem | null>(null);
  const [faceImageBase64, setFaceImageBase64] = useState<string | null>(null);
  const [isDetectingPose, setIsDetectingPose] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const [facePresent, setFacePresent] = useState(false);
  const [poseValidated, setPoseValidated] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [processing, setProcessing] = useState(false); // For UX feedback
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(0);
  const currentStepRef = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  
  // Throttling for API requests (prevent spam)
  const lastValidationTime = useRef<number>(0);
  const VALIDATION_COOLDOWN = 800; // 800ms between requests (increased for reliability)

  // FaceID Setup Steps - Memoized to prevent recreating on every render
  // Circular motion setup - track angles instead of steps
  const requiredAngles = 8; // Need 8 different angles for complete coverage

  const loadDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/student/dashboard`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
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

  const processFaceVerification = useCallback(async (images: string[]) => {
    setProcessingFace(true);

    try {
      console.log("🧠 Processing face verification...");

      if (images.length > 0) {
        setFaceImageBase64(images[0]);
        console.log("✅ Face image captured for verification");
      }

      setShowFaceSetup(false);
      setProcessingFace(false);

      // Will call completeCheckIn after this
    } catch (error) {
      console.error("❌ Face verification processing error:", error);
      Alert.alert("Lỗi", "Không thể xử lý khuôn mặt");
      setProcessingFace(false);
    }
  }, []);

  const processFaceSetup = useCallback(async (images: string[]) => {
    setProcessingFace(true);

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Lỗi", "Không tìm thấy token xác thực");
        return;
      }

      console.log(`🧠 Processing face setup with ${images.length} images from circular motion...`);

      const response = await fetch(`${API_URL}/student/setup-faceid`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: images
          // No poses needed for circular motion setup
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ FaceID setup completed");
        Alert.alert("Thành công", "FaceID đã được thiết lập! Giờ bạn có thể điểm danh.", [
          {
            text: "OK",
            onPress: () => {
              setShowFaceSetup(false);
              resetFaceSetup();
            }
          }
        ]);
      } else {
        Alert.alert("Lỗi", data.detail || "Không thể thiết lập FaceID");
        resetFaceSetup();
      }
    } catch (error) {
      console.error("❌ Face setup error:", error);
      Alert.alert("Lỗi", "Lỗi kết nối server");
      resetFaceSetup();
    } finally {
      setProcessingFace(false);
    }
  }, []);

  // Face ID style: Process collected frames for pose diversity
  const processFaceSetupFromFrames = useCallback(async (angles: Array<{yaw: number, pitch: number, timestamp: number}>) => {
    setProcessingFace(true);

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Lỗi", "Không tìm thấy token xác thực");
        return;
      }

      console.log(`🧠 Processing Face ID setup with ${angles.length} angle measurements...`);

      // Collect actual images from recent frames (we need to capture images, not just angles)
      const imagePromises = [];
      const recentAngles = angles.slice(-30); // Take last 30 frames

      for (let i = 0; i < Math.min(30, recentAngles.length); i++) {
        // Capture image for each angle measurement
        if (cameraRef.current) {
          const photoPromise = cameraRef.current.takePictureAsync({
            base64: false,
            quality: 0.8
          });
          imagePromises.push(photoPromise);
        }
      }

      const photos = await Promise.all(imagePromises);

      // Process images (resize and convert to base64)
      const imageProcessingPromises = photos.map(async (photo) => {
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 480 } }],
          { base64: true, compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        return manipulated.base64!;
      });

      const images = await Promise.all(imageProcessingPromises);

      console.log(`📸 Captured ${images.length} images for Face ID setup`);

      const response = await fetch(`${API_URL}/student/setup-faceid`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: images
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Face ID setup completed (pose diversity)");
        Alert.alert("Thành công", "Face ID đã được thiết lập thành công!", [
          {
            text: "OK",
            onPress: () => {
              resetFaceSetup();
            }
          }
        ]);
      } else {
        Alert.alert("Lỗi", data.detail || "Không thể thiết lập Face ID");
        resetFaceSetup();
      }
    } catch (error) {
      console.error("❌ Face ID setup error:", error);
      Alert.alert("Lỗi", "Lỗi kết nối server");
      resetFaceSetup();
    } finally {
      setProcessingFace(false);
    }
  }, []);

  const handlePoseDetectedCapture = useCallback(async (forceCapture = false) => {
    if (!cameraRef.current || processingFace) return;

    // Trong setup mode, chỉ cho phép capture khi pose được detect hoặc được force
    if (faceMode === 'setup' && !poseDetected && !forceCapture) {
      console.log("⚠️ Cannot capture - pose not detected correctly");
      Alert.alert("Thông báo", "Vui lòng giữ vị trí khuôn mặt đúng hướng để có thể chụp ảnh.");
      return;
    }

    try {
      const poseInstruction = faceMode === 'setup' ? 'Circular Motion' : 'Front';
      console.log(`📸 Capturing face for: ${poseInstruction}`);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.95, // Higher quality for better face detection
      });

      if (photo.base64) {
        const newImages = [...capturedImages, photo.base64];
        setCapturedImages(newImages);

        // UX Improvement: Haptic feedback when capture successful
        Vibration.vibrate(100); // Light vibration to indicate success

        // Handle capture completion based on mode
        if (faceMode === 'verify') {
          setIsDetectingPose(false);
          setPoseDetected(false);
          await processFaceVerification(newImages);
        } else {
          // For circular motion setup, completion is handled in detection loop
          // This should not be called in normal flow
          console.log('Unexpected capture in circular motion mode');
        }
      }
    } catch (error) {
      console.error("❌ Capture error:", error);
      Alert.alert("Lỗi", "Không thể chụp ảnh");
      setIsDetectingPose(false);
      setPoseDetected(false);
    }
  }, [processingFace, faceMode, poseDetected, capturedImages, processFaceVerification, processFaceSetup]);

  const completeCheckIn = useCallback(async () => {
    try {
      if (!currentClassItem) {
        Alert.alert("Lỗi", "Không tìm thấy thông tin lớp học");
        return;
      }

      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Lỗi", "Cần quyền truy cập vị trí để điểm danh");
        return;
      }

      console.log("📍 Getting current location...");
      const location = await Location.getCurrentPositionAsync({});
      console.log(`📍 Location: ${location.coords.latitude}, ${location.coords.longitude}`);

      const response = await fetch(`${API_URL}/attendance/checkin`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_id: currentClassItem.class_id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          image: faceImageBase64,
        }),
      });

      const data = await response.json();
      console.log("📊 Attendance response:", data);

      if (response.ok) {
        console.log(`✅ Attendance successful for ${currentClassItem.class_name}`);
        console.log(`📍 GPS Coordinates: ${location.coords.latitude}, ${location.coords.longitude}`);

        const faceValidation = data.validations?.face;
        const gpsValidation = data.validations?.gps;

        console.log(`🧠 Face Validation: ${faceValidation?.message} (Score: ${faceValidation?.similarity_score?.toFixed(3) || 'N/A'})`);
        console.log(`📍 GPS Validation: ${gpsValidation?.message} (Distance: ${gpsValidation?.distance_meters}m)`);

        if (data.warnings && data.warnings.length > 0) {
          console.log(`⚠️ Warnings: ${data.warnings.join(', ')}`);
        }

        let alertTitle = "Thành công";
        let alertMessage = data.message;

        if (data.warnings && data.warnings.length > 0) {
          alertTitle = "Điểm danh thành công (Có cảnh báo)";
          alertMessage += `\n\n⚠️ Cảnh báo:\n${data.warnings.join('\n')}`;
        }

        alertMessage += `\n\n📍 Vị trí: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;

        Alert.alert(alertTitle, alertMessage);

        console.log("📡 Real-time notification sent to teacher with validation details");

        loadDashboard();
      } else {
        console.log(`❌ Attendance failed: ${data.detail || data.message}`);
        Alert.alert("Lỗi", data.detail || data.message || "Điểm danh thất bại");
      }
    } catch (error) {
      console.error("❌ Check-in error:", error);
      Alert.alert("Lỗi", "Không thể điểm danh");
    }
  }, [currentClassItem, faceImageBase64, loadDashboard, router]);

  // Auto complete check-in after face verification
  useEffect(() => {
    if (faceImageBase64 && currentClassItem && !showFaceSetup) {
      completeCheckIn();
    }
  }, [faceImageBase64, currentClassItem, showFaceSetup, completeCheckIn]);

  const handleCheckIn = async (classItem: ScheduleItem) => {
    try {
      setCurrentClassItem(classItem);
      setFaceImageBase64(null);

      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      console.log("🔍 Checking face embedding setup...");
      const profileResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (profileResponse.ok) {
        const userData = await profileResponse.json();
        if (!userData.face_embedding) {
          console.log("⚠️ No face embedding found, starting FaceID setup");

          if (!permission) {
            await requestPermission();
            return;
          }

          if (!permission.granted) {
            Alert.alert(
              "Cần quyền Camera",
              "Ứng dụng cần quyền truy cập camera để thiết lập FaceID",
              [
                { text: "Hủy", style: "cancel" },
                { text: "Cấp quyền", onPress: requestPermission }
              ]
            );
            return;
          }

          setFaceMode('setup');
          resetFaceSetup();
          setShowFaceSetup(true);
          return;
        }
        console.log("✅ Face embedding found, proceeding with attendance");
      }

      console.log("📸 Capturing face image for verification...");

      if (!permission) {
        await requestPermission();
        return;
      }

      if (!permission.granted) {
        Alert.alert(
          "Cần quyền Camera",
          "Ứng dụng cần quyền truy cập camera để xác thực khuôn mặt",
          [
            { text: "Hủy", style: "cancel" },
            { text: "Cấp quyền", onPress: requestPermission }
          ]
        );
        return;
      }

      console.log("📷 Opening camera for face capture...");
      setFaceMode('verify');
      setCapturedImages([]);
      setCircularProgress(0);
      setCapturedAngles(new Set());
      setShowFaceSetup(true);
    } catch (error) {
      console.error("❌ Attendance error:", error);
      Alert.alert("Lỗi", "Không thể điểm danh");
    }
  };

  // Face presence and pose validation using backend API
  // Countdown and capture function
  const startCountdownAndCapture = useCallback((pose: string) => {
    setCountdownActive(true);
    setCountdownValue(3);
    setDetectionMessage(`🎯 Giữ tư thế ${pose} trong 3 giây...`);

    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        const newValue = prev - 1;
        if (newValue > 0) {
          setDetectionMessage(`🎯 Giữ tư thế ${pose} trong ${newValue} giây...`);
          return newValue;
        } else {
          // Countdown finished - capture now
          clearInterval(countdownInterval);
          setCountdownActive(false);
          setDetectionMessage('✅ Phát hiện thành công! Đang chụp...');
          handlePoseDetectedCapture(true);
          return 0;
        }
      });
    }, 1000);
  }, [handlePoseDetectedCapture]);

  const detectFaceAndAngle = useCallback(async (imageUri: string) => {
    const now = Date.now();

    // Throttling: Skip if too frequent (prevent spam)
    if (now - lastValidationTime.current < VALIDATION_COOLDOWN) {
      console.log('⏱️ Validation throttled - too frequent, assuming success');
      // Return assumed success to prevent blocking UX
      return {
        facePresent: true,
        detectedAngle: 0,
        poseType: 'processing'
      };
    }
    lastValidationTime.current = now;

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        return { facePresent: false, detectedAngle: 0, poseType: 'no_token' };
      }

      // Client-side resize for bandwidth optimization (480p is enough for face detection)
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 480 } }],  // Reduced from 640x480 to save bandwidth
        { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }  // Reduced compression for smaller payload
      );

      if (!manipulatedImage.base64) {
        return { facePresent: false, detectedAngle: 0, poseType: 'processing_error' };
      }

      console.log(`📡 Sending angle detection request`);

      const response = await fetch(`${API_URL}/detect-face-angle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: manipulatedImage.base64!
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Face angle detection API error:', errorData);
        return { facePresent: false, detectedAngle: 0, poseType: 'unknown' };
      }

      const result = await response.json();
      console.log(`✅ Face angle detection: ${result.face_present ? 'present' : 'absent'}, yaw: ${result.yaw}°, pitch: ${result.pitch}°`);

      const facePresent = result.face_present || false;

      return {
        facePresent,
        yaw: result.yaw || 0,
        pitch: result.pitch || 0,
        poseType: result.friendly_name || result.detected_pose
      };

    } catch (error) {
      console.error("❌ Face angle detection error:", error);
      return { facePresent: false, detectedAngle: 0, poseType: 'network_error' };
    }
  }, []);

  // Pose detection effect with real face validation
  useEffect(() => {
    if (showFaceSetup && faceMode === 'setup' && isDetectingPose && !poseDetected) {
      console.log(`🔍 Detecting face angles for circular motion (${capturedAngles.size}/${requiredAngles})...`);

      let detectionTimeout: number;
      let isValidating = false;

        const performPoseDetection = async () => {
          if (isValidating || !cameraRef.current || countdownActive) return; // Skip if countdown active
          isValidating = true;

        try {
          // Capture test frame for validation
          const testPhoto = await cameraRef.current.takePictureAsync({
            base64: false,
            quality: 0.3 // Lower quality for faster processing
          });

          const detection = await detectFaceAndAngle(testPhoto.uri);

          // Skip if throttled (detection is null)
          if (!detection) {
            console.log('⏱️ Skipping this frame due to throttling');
            detectionTimeout = setTimeout(() => {
              setIsDetectingPose(false);
              setTimeout(() => setIsDetectingPose(true), 200);
            }, 200);
            return;
          }

          if (detection.facePresent) {
            // Face ID style: Collect yaw/pitch for pose diversity calculation
            const yaw = detection.yaw;
            const pitch = detection.pitch;

            // Add to collected angles for diversity calculation
            setCollectedAngles(prev => [...prev, { yaw, pitch, timestamp: Date.now() }]);

            console.log(`📊 Collected angle: yaw=${yaw.toFixed(1)}°, pitch=${pitch.toFixed(1)}°`);

            // Update progress based on number of collected frames (not unique angles)
            const newProgress = Math.min((collectedAngles.length + 1) / requiredFrames, 1.0);
            setCircularProgress(newProgress * 100);

            // Check if we have enough frames for diversity
            if (collectedAngles.length + 1 >= requiredFrames) {
              console.log('🎉 Collected enough frames for pose diversity!');
              setDetectionMessage('🎉 Đã thu thập đủ dữ liệu! Đang xử lý...');

              // Process all collected frames
              await processFaceSetupFromFrames(collectedAngles.concat([{ yaw, pitch, timestamp: Date.now() }]));
              return;
            } else {
              setDetectionMessage(`🔄 Thu thập dữ liệu khuôn mặt... (${collectedAngles.length + 1}/${requiredFrames})`);
            }

          } else {
            console.log(`❌ Face detection failed - no face present`);

            setDetectionMessage("Không tìm thấy khuôn mặt trong khung hình");
            setFacePresent(false);
            setPoseValidated(false);

            // Try again after 500ms
            detectionTimeout = setTimeout(() => {
              setIsDetectingPose(false);
              setTimeout(() => setIsDetectingPose(true), 200);
            }, 500);
          }
        } catch (error) {
          console.error("Pose detection error:", error);
          // Fallback to basic detection if validation fails
          console.log(`⚠️ Validation failed, using fallback detection for circular motion`);
          setPoseDetected(true);
          setCaptureReady(true);
          handlePoseDetectedCapture(true);
        } finally {
          isValidating = false;
        }
      };

      // Start pose detection immediately
      performPoseDetection();

      return () => {
        if (detectionTimeout) {
          clearTimeout(detectionTimeout);
        }
      };
    }
  }, [showFaceSetup, faceMode, isDetectingPose, collectedAngles.length, requiredFrames]);

  // Start pose detection when step changes (only when starting fresh, not after capture)
  useEffect(() => {
    if (showFaceSetup && faceMode === 'setup' && !isDetectingPose && collectedAngles.length < requiredFrames) {
      console.log(`👀 Starting continuous detection (${collectedAngles.length}/${requiredFrames} frames collected)`);
      setIsDetectingPose(true);
      setPoseDetected(false);
      setCaptureReady(false);
      setFacePresent(false);
      setPoseValidated(false);
      setCountdownActive(false);
      setCountdownValue(0);
      // Don't reset circular progress here as we continue collecting
      setDetectionMessage(''); // Clear previous detection message
      setCountdownActive(false);
      setCountdownValue(0);
    }
  }, [showFaceSetup, faceMode, isDetectingPose, collectedAngles.length, requiredFrames]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!showFaceSetup) {
      setIsDetectingPose(false);
      setPoseDetected(false);
      setCaptureReady(false);
      setFacePresent(false);
      setPoseValidated(false);
      setCountdownActive(false);
      setCountdownValue(0);
      // Don't reset circular progress here as we continue collecting
    }
  }, [showFaceSetup]);

  const takeFacePhoto = async () => {
    if (!cameraRef.current || processingFace) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo.base64) {
        const newImages = [...capturedImages, photo.base64];
        setCapturedImages(newImages);

        // Handle capture completion based on mode
        if (faceMode === 'verify') {
          await processFaceVerification(newImages);
        } else {
          // For circular motion setup, completion is handled in detection loop
          console.log('Unexpected capture in circular motion mode');
        }
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chụp ảnh");
    }
  };


  const resetFaceSetup = () => {
    setCapturedImages([]);
    setCircularProgress(0);
    setCapturedAngles(new Set());
    setIsDetectingPose(false);
    setPoseDetected(false);
    setCaptureReady(false);
    setFacePresent(false);
    setPoseValidated(false);
    setDetectionMessage('');
    setCountdownActive(false);
    setCountdownValue(0);
  };

  const cancelFaceSetup = () => {
    setShowFaceSetup(false);
    resetFaceSetup();
    setIsDetectingPose(false);
    setPoseDetected(false);
    setCaptureReady(false);
    setFacePresent(false);
    setPoseValidated(false);
    setDetectionMessage('');
  };

  const handleClassPress = (classItem: ScheduleItem) => {
    router.push({
      pathname: "/class-detail",
      params: { classId: classItem.class_id, className: classItem.class_name }
    });
  };

  const handleLogout = async () => {
    const token = await AsyncStorage.getItem("access_token");
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
        style={{flex: 1}}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.welcome}>
            Xin chào, {dashboardData.student_name}!
          </Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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

      {/* FaceID Setup Modal */}
      {showFaceSetup && (
      <View style={styles.faceSetupModal}>
        <View style={styles.faceSetupHeader}>
          <Text style={styles.faceSetupTitle}>
            {faceMode === 'setup' ? 'Thiết lập FaceID' : 'Xác thực khuôn mặt'}
          </Text>
          <Text style={styles.faceSetupSubtitle}>
            {faceMode === 'setup'
              ? "Thiết lập Face ID"
              : 'Chụp ảnh khuôn mặt để điểm danh'
            }
          </Text>
        </View>

        <View style={styles.faceSetupContainer}>
          {/* Camera Preview in Circle */}
          <View style={styles.cameraCircleContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.faceSetupCamera}
              facing="front"
            />

            {/* Circular mask to show only camera inside circle */}
            <View style={styles.cameraMask}>
              <View style={styles.cameraMaskHole} />
            </View>
          </View>

          {/* Instructions and Progress outside circle */}
          <View style={styles.instructionsContainer}>
            {/* Circular Progress Bar with Segments */}
            <View style={styles.circularProgressContainer}>
              <View style={styles.circularProgressBackground}>
                {/* Render 8 segments around the circle */}
                {Array.from({ length: 8 }, (_, index) => {
                  const angle = index * 45; // 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
                  const isCaptured = capturedAngles.has(angle);

                  // Calculate position on circle (radius = 60)
                  const radian = (angle - 90) * (Math.PI / 180); // -90 to align with top
                  const x = Math.cos(radian) * 60;
                  const y = Math.sin(radian) * 60;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.circularSegment,
                        {
                          left: 70 + x - 8, // Center horizontally (70 = half width) minus half segment
                          top: 70 + y - 8,  // Center vertically minus half segment
                        }
                      ]}
                    >
                      <View
                        style={[
                          styles.segmentIndicator,
                          isCaptured ? styles.segmentActive : styles.segmentInactive
                        ]}
                      />
                    </View>
                  );
                })}

                <View style={styles.circularProgressCenter}>
                  <Text style={styles.circularProgressText}>
                    {collectedAngles.length}
                  </Text>
                  <Text style={styles.circularProgressSubtext}>
                    /{requiredFrames}
                  </Text>
                </View>
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.faceGuide}>
              <Text style={styles.faceGuideText}>
                {faceMode === 'setup'
                  ? 'Quay đầu chậm rãi theo vòng tròn để thu thập dữ liệu khuôn mặt'
                  : 'Hướng mặt về phía trước'
                }
              </Text>
              <Text style={[styles.faceGuideText, {fontSize: 14, color: '#666', marginTop: 5}]}>
                (Thu thập dữ liệu đa góc độ để tăng độ chính xác)
              </Text>
              <Text style={styles.faceAngleText}>
                {faceMode === 'setup'
                  ? 'Face ID Setup'
                  : 'Front'
                }
              </Text>
              {/* Face and pose detection status */}
              {isDetectingPose && (
                <View style={styles.detectionContainer}>
                  <Text style={[
                    styles.detectionText,
                    countdownActive && countdownValue > 0 && styles.countdownText
                  ]}>
                    {countdownActive && countdownValue > 0
                      ? countdownValue
                      : poseDetected
                      ? '✅ Phát hiện thành công!'
                      : detectionMessage || '🔍 Đang phân tích...'
                    }
                  </Text>
                  {countdownActive && countdownValue > 0 && (
                    <Text style={styles.countdownInstruction}>
                      Giữ nguyên tư thế khuôn mặt
                    </Text>
                  )}
                  {!poseDetected && detectionMessage && (
                    <View style={[
                      styles.detectionIndicator,
                      !facePresent && styles.detectionError,
                      facePresent && !poseValidated && styles.detectionWarning
                    ]}>
                      <Text style={styles.detectionStatus}>
                        {detectionMessage}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.faceSetupControls}>

          {/* Remove old overlay content */}
          <View style={styles.faceSetupOverlay}>
            <View style={styles.faceGuide}>
              <Text style={styles.faceGuideText}>
                {faceMode === 'setup'
                  ? 'Quay đầu chậm rãi theo vòng tròn để thu thập dữ liệu khuôn mặt'
                  : 'Hướng mặt về phía trước'
                }
              </Text>
              <Text style={[styles.faceGuideText, {fontSize: 14, color: '#666', marginTop: 5}]}>
                (Thu thập dữ liệu đa góc độ để tăng độ chính xác)
              </Text>
              <Text style={styles.faceAngleText}>
                {faceMode === 'setup'
                  ? 'Face ID Setup'
                  : 'Front'
                }
              </Text>
              {/* Face and pose detection status */}
              {isDetectingPose && (
                <View style={styles.detectionContainer}>
                  <Text style={[
                    styles.detectionText,
                    countdownActive && countdownValue > 0 && styles.countdownText
                  ]}>
                    {countdownActive && countdownValue > 0
                      ? countdownValue
                      : poseDetected
                      ? '✅ Phát hiện thành công!'
                      : detectionMessage || '🔍 Đang phân tích...'
                    }
                  </Text>
                  {countdownActive && countdownValue > 0 && (
                    <Text style={styles.countdownInstruction}>
                      Giữ nguyên tư thế khuôn mặt
                    </Text>
                  )}
                  {!poseDetected && detectionMessage && (
                    <View style={[
                      styles.detectionIndicator,
                      !facePresent && styles.detectionError,
                      facePresent && !poseValidated && styles.detectionWarning
                    ]}>
                      <Text style={styles.detectionStatus}>
                        {detectionMessage}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.faceSetupControls}>
          {faceMode === 'setup' && (
            <View style={styles.faceSetupProgressContainer}>
              {/* Circular Progress Bar with Segments */}
              <View style={styles.circularProgressContainer}>
                <View style={styles.circularProgressBackground}>
                  {/* Render 8 segments around the circle */}
                  {Array.from({ length: 8 }, (_, index) => {
                    const angle = index * 45; // 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
                    const isCaptured = capturedAngles.has(angle);

                    // Calculate position on circle (radius = 60)
                    const radian = (angle - 90) * (Math.PI / 180); // -90 to align with top
                    const x = Math.cos(radian) * 60;
                    const y = Math.sin(radian) * 60;

                    return (
                      <View
                        key={index}
                        style={[
                          styles.circularSegment,
                          {
                            left: 70 + x - 8, // Center horizontally (70 = half width) minus half segment
                            top: 70 + y - 8,  // Center vertically minus half segment
                          }
                        ]}
                      >
                        <View
                          style={[
                            styles.segmentIndicator,
                            isCaptured ? styles.segmentActive : styles.segmentInactive
                          ]}
                        />
                      </View>
                    );
                  })}

                  <View style={styles.circularProgressCenter}>
                    <Text style={styles.circularProgressText}>
                      {capturedAngles.size}
                    </Text>
                    <Text style={styles.circularProgressSubtext}>
                      /8 góc
                    </Text>
                  </View>
                </View>

                {/* Instruction Text */}
                <Text style={styles.circularInstruction}>
                  Quay mặt chậm rãi theo vòng tròn để ghi nhận đủ 8 góc độ
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.faceSetupInstruction}>
            {isDetectingPose
              ? (poseDetected
                  ? "Đang chụp ảnh..."
                  : !facePresent
                    ? "Không tìm thấy khuôn mặt - Hãy đưa khuôn mặt vào khung hình"
                    : !poseValidated
                      ? "Tiếp tục quay mặt theo vòng tròn"
                      : "Đang phát hiện tư thế... Giữ nguyên vị trí khuôn mặt!"
                )
              : "Chuẩn bị vị trí khuôn mặt..."
            }
          </Text>

          <View style={styles.faceSetupButtonContainer}>
            {faceMode === 'setup' ? (
              capturedAngles.size < requiredAngles ? (
                <>
                  <TouchableOpacity
                    style={[styles.faceSetupPrimaryButton, (processingFace || isDetectingPose || !captureReady || processing) && styles.faceSetupButtonDisabled]}
                    onPress={() => handlePoseDetectedCapture()}
                    disabled={processingFace || isDetectingPose || !captureReady || processing}
                  >
                    <Text style={styles.faceSetupPrimaryButtonText}>
                      {processing ? "Đang chuyển..." : isDetectingPose ? (poseDetected ? "Đang chụp..." : "Tự động") : captureReady ? "Chụp ngay" : "Chuẩn bị..."}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.faceSetupSecondaryButton}
                    onPress={resetFaceSetup}
                    disabled={isDetectingPose}
                  >
                    <Text style={styles.faceSetupSecondaryButtonText}>Chụp lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.faceSetupPrimaryButton, processingFace && styles.faceSetupButtonDisabled]}
                    onPress={() => handlePoseDetectedCapture()}
                    disabled={processingFace}
                  >
                    <Text style={styles.faceSetupPrimaryButtonText}>
                      {processingFace ? "Đang xử lý..." : isDetectingPose ? (poseDetected ? "Đang chụp..." : "Tự động") : "Hoàn thành"}
                    </Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              // Verify mode - simple capture button
              <TouchableOpacity
                style={[styles.faceSetupPrimaryButton, processingFace && styles.faceSetupButtonDisabled]}
                onPress={takeFacePhoto}
                disabled={processingFace}
              >
                <Text style={styles.faceSetupPrimaryButtonText}>
                  {processingFace ? "Đang xử lý..." : "Chụp ảnh & Điểm danh"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.faceSetupCancelButton}
            onPress={cancelFaceSetup}
          >
            <Text style={styles.faceSetupCancelText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
  backgroundColor: '#fff', // hoặc màu header
},

  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  welcome: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    padding: 20,
    paddingBottom: 10,
    color: "#333",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  classCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  className: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  room: {
    fontSize: 14,
    color: "#666",
  },
  teacher: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  time: {
    fontSize: 16,
    color: "#333",
    marginBottom: 15,
  },
  attendanceSection: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    fontSize: 14,
    fontWeight: "bold",
  },
  presentBadge: {
    backgroundColor: "#34C759",
    color: "white",
  },
  pendingBadge: {
    backgroundColor: "#FF9500",
    color: "white",
  },
  checkInButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkInText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  // FaceID Setup Modal Styles
  faceSetupModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 1000,
  },
  faceSetupHeader: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
  },
  faceSetupTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  faceSetupSubtitle: {
    fontSize: 16,
    color: "#ccc",
  },
  faceSetupContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  faceSetupCameraContainer: {
    flex: 1,
    position: "relative",
  },
  faceSetupCamera: {
    flex: 1,
  },
  cameraCircleContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 20,
  },
  cameraMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraMaskHole: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  faceSetupOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  faceGuide: {
    backgroundColor: "#F5F5F5",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  faceGuideText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  faceAngleText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "bold",
    marginBottom: 15,
  },
  detectionContainer: {
    alignItems: "center",
  },
  detectionText: {
    fontSize: 16,
    color: "#00FF00",
    fontWeight: "bold",
    marginBottom: 10,
  },
  countdownInstruction: {
    fontSize: 14,
    color: "#FFA500",
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },
  countdownText: {
    fontSize: 48,
    color: "#FF6B35",
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  detectionIndicator: {
    width: 80,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  detectionError: {
    backgroundColor: "#FF4444",
  },
  detectionWarning: {
    backgroundColor: "#FF8800",
  },
  detectionStatus: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  faceSetupControls: {
    backgroundColor: "white",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  faceSetupProgressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  faceSetupProgressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  faceSetupProgressDotActive: {
    backgroundColor: "#007AFF",
  },
  circularProgressContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  circularProgressBackground: {
    width: 140,
    height: 140,
    borderRadius: 70,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  circularSegment: {
    position: "absolute",
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  segmentActive: {
    backgroundColor: "#007AFF", // Blue for captured
    borderColor: "#007AFF",
  },
  segmentInactive: {
    backgroundColor: "transparent", // Transparent center
    borderColor: "#E5E5E5", // Gray border for uncaptured
  },
  circularProgressCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E5E5",
  },
  circularProgressText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  circularProgressSubtext: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
    textAlign: "center",
  },
  circularInstruction: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 15,
    fontStyle: "italic",
  },
  faceSetupInstruction: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
    lineHeight: 24,
  },
  faceSetupButtonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  faceSetupPrimaryButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  faceSetupPrimaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  faceSetupSecondaryButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  faceSetupSecondaryButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  faceSetupButtonDisabled: {
    opacity: 0.6,
  },
  faceSetupCancelButton: {
    alignItems: "center",
    padding: 10,
  },
  faceSetupCancelText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "500",
  },
});