import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { useState, useEffect } from "react";
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
}

export default function TeacherClassDetailScreen() {
  const { classId, className } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [newDocumentDesc, setNewDocumentDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadClassData = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
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
    return record ? record.status : "not_checked_in";
  };

  useEffect(() => {
    loadClassData();
  }, []);

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
            const status = getAttendanceStatus(student._id);

            return (
              <View key={student._id} style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.full_name}</Text>
                  <Text style={styles.studentId}>{student.student_id}</Text>
                </View>

                <View style={styles.attendanceStatus}>
                  {status === "present" ? (
                    <Text style={[styles.statusBadge, styles.presentBadge]}>✓ Có mặt</Text>
                  ) : status === "late" ? (
                    <Text style={[styles.statusBadge, styles.lateBadge]}>⏰ Muộn</Text>
                  ) : status === "absent" ? (
                    <Text style={[styles.statusBadge, styles.absentBadge]}>❌ Vắng</Text>
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
