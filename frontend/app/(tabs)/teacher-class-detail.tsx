import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_URL } from "../../config/api";

interface Student {
  _id: string;
  full_name: string;
  student_id: string;
}

interface AttendanceRecord {
  student_id: string;
  student_name: string;
  status: string;
  check_in_time?: string;
  validations?: {
    face?: { is_valid: boolean; message?: string; similarity_score?: number };
    gps?: { is_valid: boolean; message?: string; distance_meters?: number };
  };
  error_type?: string; // 'gps_invalid' | 'face_invalid'
}

export default function TeacherClassDetailScreen() {
  const { classId, className } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [newDocumentDesc, setNewDocumentDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(5000); // Start with 5 seconds

  // WebSocket connection for real-time attendance updates
  const connectWebSocket = (teacherId: string) => {
    try {
      // Extract host from API_URL and use port 8002 for WebSocket
      const apiHost = API_URL.replace('http://', '').replace('https://', '').split(':')[0];
      const wsUrl = `ws://${apiHost}:8002/ws/teacher/${teacherId}`;
      console.log('🔌 Connecting WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('📡 WebSocket connected for class detail:', classId);
        // Reset reconnect delay on successful connection
        reconnectDelayRef.current = 5000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', data);

          // Handle attendance updates for this class
          if (data.class_id === classId) {
            handleAttendanceUpdate(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Exponential backoff: double delay on each failure, max 60 seconds
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 60000);
        console.log(`🔄 Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => {
          if (currentUser) {
            connectWebSocket(currentUser._id || currentUser.id);
          }
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  // Handle real-time attendance update
  const handleAttendanceUpdate = (notification: any) => {
    console.log('🔄 Processing attendance update for class:', notification);

    // Extract validation details from notification
    const validationDetails = notification.validation_details || {};
    
    const newRecord: AttendanceRecord = {
      student_id: notification.student_id,
      student_name: notification.student_name,
      status: notification.status || (notification.type === 'gps_invalid_attendance' ? 'gps_invalid' : 'present'),
      check_in_time: notification.check_in_time || notification.timestamp,
      validations: {
        face: { 
          is_valid: notification.type !== 'face_invalid_attendance',
          similarity_score: validationDetails.face?.similarity_score || notification.face_similarity 
        },
        gps: { 
          is_valid: notification.type !== 'gps_invalid_attendance',
          distance_meters: validationDetails.gps?.distance_meters || notification.gps_distance 
        }
      },
      error_type: notification.type === 'gps_invalid_attendance' ? 'gps_invalid' : 
                  notification.type === 'face_invalid_attendance' ? 'face_invalid' : undefined
    };

    // Update or add the attendance record
    setAttendanceRecords(prev => {
      const existingIndex = prev.findIndex(r => r.student_id === newRecord.student_id);
      if (existingIndex >= 0) {
        // Update existing record
        const updated = [...prev];
        updated[existingIndex] = newRecord;
        return updated;
      } else {
        // Add new record
        return [...prev, newRecord];
      }
    });

    // Show notification toast
    const statusText = newRecord.error_type === 'gps_invalid' ? '📍 GPS không hợp lệ' :
                       newRecord.error_type === 'face_invalid' ? '🚫 Face ID không khớp' :
                       '✅ Điểm danh thành công';
    
    Alert.alert(
      "Cập nhật điểm danh",
      `${notification.student_name}: ${statusText}`,
      [{ text: "OK" }],
      { cancelable: true }
    );
  };

  const loadClassData = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Get current user info for WebSocket
      const userResponse = await fetch(`${API_URL}/auth/me`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCurrentUser(userData);
      }

      // Load students in class
      const studentsResponse = await fetch(`${API_URL}/classes/${classId}/students`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        setStudents(studentsData.students || []);
      }

      // Load attendance records for today
      const attendanceResponse = await fetch(`${API_URL}/attendance/class/${classId}/today`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setAttendanceRecords(attendanceData.records || []);
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu lớp học");
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async () => {
    if (!newDocumentTitle.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tiêu đề tài liệu");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");

      // In a real app, you would upload a file here
      // For demo, we'll just create a document record
      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_id: classId,
          title: newDocumentTitle.trim(),
          description: newDocumentDesc.trim(),
          file_url: `https://example.com/docs/${Date.now()}.pdf`, // Mock URL
        }),
      });

      if (response.ok) {
        Alert.alert("Thành công", "Tài liệu đã được upload");
        setNewDocumentTitle("");
        setNewDocumentDesc("");
      } else {
        Alert.alert("Lỗi", "Không thể upload tài liệu");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Lỗi kết nối");
    }
  };

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(r => r.student_id === studentId);
    if (!record) return { status: "not_checked_in", details: null };
    
    // Check for validation failures
    if (record.error_type === 'gps_invalid' || 
        (record.validations?.gps && !record.validations.gps.is_valid)) {
      return { 
        status: "gps_invalid", 
        details: record.validations?.gps?.distance_meters 
      };
    }
    
    if (record.error_type === 'face_invalid' || 
        (record.validations?.face && !record.validations.face.is_valid)) {
      return { 
        status: "face_invalid", 
        details: record.validations?.face?.similarity_score 
      };
    }
    
    return { status: record.status, details: null };
  };

  useEffect(() => {
    loadClassData();
  }, []);

  // Setup WebSocket when we have user info
  useEffect(() => {
    if (currentUser && (currentUser._id || currentUser.id)) {
      connectWebSocket(currentUser._id || currentUser.id);
    }

    return () => {
      // Cleanup WebSocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.classTitle}>{className}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danh sách sinh viên ({students.length})</Text>

        {loading ? (
          <View style={styles.center}>
            <Text>Đang tải...</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Chưa có sinh viên nào trong lớp</Text>
          </View>
        ) : (
          students.map((student) => {
            const { status, details } = getAttendanceStatus(student._id);

            return (
              <View key={student._id} style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.full_name}</Text>
                  <Text style={styles.studentId}>{student.student_id}</Text>
                  <Text style={styles.lastEdited}>Chỉnh sửa lần cuối: {new Date().toLocaleDateString()}</Text>
                </View>

                <View style={styles.attendanceStatus}>
                  {status === "present" ? (
                    <Text style={[styles.statusBadge, styles.presentBadge]}>✓ Có mặt</Text>
                  ) : status === "late" ? (
                    <Text style={[styles.statusBadge, styles.lateBadge]}>⏰ Muộn</Text>
                  ) : status === "absent" ? (
                    <Text style={[styles.statusBadge, styles.absentBadge]}>❌ Vắng</Text>
                  ) : status === "gps_invalid" ? (
                    <View style={styles.invalidStatusContainer}>
                      <Text style={[styles.statusBadge, styles.gpsInvalidBadge]}>📍 GPS không hợp lệ</Text>
                      {details && <Text style={styles.invalidDetails}>Cách {details}m</Text>}
                    </View>
                  ) : status === "face_invalid" ? (
                    <View style={styles.invalidStatusContainer}>
                      <Text style={[styles.statusBadge, styles.faceInvalidBadge]}>🚫 Face ID không khớp</Text>
                      {details && <Text style={styles.invalidDetails}>{(details * 100).toFixed(1)}%</Text>}
                    </View>
                  ) : (
                    <Text style={[styles.statusBadge, styles.notCheckedBadge]}>⏳ Chưa điểm danh</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload tài liệu</Text>

        <TextInput
          style={styles.input}
          placeholder="Tiêu đề tài liệu *"
          value={newDocumentTitle}
          onChangeText={setNewDocumentTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Mô tả tài liệu (tùy chọn)"
          value={newDocumentDesc}
          onChangeText={setNewDocumentDesc}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity style={styles.uploadButton} onPress={uploadDocument}>
          <Text style={styles.uploadText}>📎 Upload tài liệu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quản lý lớp học</Text>

        <TouchableOpacity style={styles.managementCard}>
          <Text style={styles.managementTitle}>📊 Báo cáo chi tiết</Text>
          <Text style={styles.managementDescription}>
            Xem báo cáo điểm danh theo ngày/tháng
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.managementCard}>
          <Text style={styles.managementTitle}>👥 Thêm sinh viên</Text>
          <Text style={styles.managementDescription}>
            Thêm sinh viên mới vào lớp học
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: "#007AFF",
    fontSize: 16,
  },
  classTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  center: {
    alignItems: "center",
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "white",
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  studentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: "#666",
  },
  lastEdited: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  attendanceStatus: {
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
  lateBadge: {
    backgroundColor: "#FF9500",
    color: "white",
  },
  absentBadge: {
    backgroundColor: "#FF3B30",
    color: "white",
  },
  notCheckedBadge: {
    backgroundColor: "#8E8E93",
    color: "white",
  },
  // GPS Invalid and Face Invalid styles
  gpsInvalidBadge: {
    backgroundColor: "#FF9500",
    color: "white",
  },
  faceInvalidBadge: {
    backgroundColor: "#FF3B30",
    color: "white",
  },
  invalidStatusContainer: {
    alignItems: "flex-end",
  },
  invalidDetails: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  uploadButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  uploadText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  managementCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  managementTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  managementDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
});
