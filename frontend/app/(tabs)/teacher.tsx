import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_URL } from "../../config/api";

interface ClassInfo {
  _id: string;
  class_code: string;
  class_name: string;
  schedule: any[];
  students: string[];
  student_count: number;
  created_at: string;
}

interface AttendanceSummary {
  class_id: string;
  class_name: string;
  total_students: number;
  present_today: number;
  absent_today: number;
}

interface ValidationDetails {
  face: {
    is_valid: boolean;
    message: string;
    similarity_score?: number;
  };
  gps: {
    is_valid: boolean;
    message: string;
    distance_meters?: number;
  };
}

interface StudentAttendance {
  student_id: string;
  student_name: string;
  status: string;
  check_in_time?: string;
  validations?: ValidationDetails;
  warnings?: string[];
}

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  const connectWebSocket = (teacherId: string) => {
    try {
      const wsUrl = `ws://localhost:8001/ws/teacher/${teacherId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for teacher:', teacherId);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);

          if (data.type === 'attendance_update') {
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
        // Auto reconnect after 5 seconds
        setTimeout(() => {
          if (currentUser) {
            connectWebSocket(currentUser._id);
          }
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  // Handle attendance update notifications
  const handleAttendanceUpdate = (notification: any) => {
    console.log('Processing attendance update:', notification);

    // Add to recent notifications
    setRecentNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10

    // Update attendance summary for the class
    setAttendanceSummary(prev =>
      prev.map(summary => {
        if (summary.class_id === notification.class_id) {
          return {
            ...summary,
            present_today: summary.present_today + (notification.status === 'present' ? 1 : 0),
            absent_today: Math.max(0, summary.total_students - summary.present_today - (notification.status === 'present' ? 1 : 0))
          };
        }
        return summary;
      })
    );

    // Show toast notification
    Alert.alert(
      "Điểm danh mới",
      `${notification.student_name}: ${notification.message}`,
      [{ text: "OK" }],
      { cancelable: true }
    );
  };

  const loadDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Get current user info
      const userResponse = await fetch(`${API_URL}/auth/me`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCurrentUser(userData);
      }

      // Load teacher's classes
      const classesResponse = await fetch(`${API_URL}/classes/my-classes`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (classesResponse.ok) {
        const classesData = await classesResponse.json();
        setClasses(classesData.classes || []);
      }

      // Load attendance summary for today
      const attendanceResponse = await fetch(`${API_URL}/attendance/teacher-summary`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setAttendanceSummary(attendanceData.summary || []);
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleClassPress = (classItem: ClassInfo) => {
    router.push({
      pathname: "/teacher-class-detail",
      params: { classId: classItem._id, className: classItem.class_name }
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Setup WebSocket when we have user info
  useEffect(() => {
    if (currentUser && currentUser._id) {
      connectWebSocket(currentUser._id);
    }

    return () => {
      // Cleanup WebSocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser]);

  const handleAttendanceNotification = (notification: any) => {
    console.log("📡 Received attendance notification:", notification);

    // Add to recent notifications
    setRecentNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10

    // Show alert for new attendance
    const hasWarnings = notification.warnings && notification.warnings.length > 0;
    const alertTitle = hasWarnings ? "Điểm danh (Có cảnh báo)" : "Điểm danh thành công";

    let alertMessage = `${notification.student_name} đã điểm danh lớp ${notification.class_name}`;
    if (hasWarnings) {
      alertMessage += `\n\n⚠️ Cảnh báo:\n${notification.warnings.join('\n')}`;
    }

    Alert.alert(alertTitle, alertMessage);

    // Refresh attendance summary
    loadDashboardData();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Dashboard Giáo viên</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Notifications */}
      {recentNotifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo gần đây</Text>
          {recentNotifications.slice(0, 3).map((notification, index) => (
            <View key={index} style={[
              styles.notificationCard,
              notification.has_warnings && styles.notificationWarning
            ]}>
              <Text style={styles.notificationText}>
                {notification.student_name} - {notification.class_name}
              </Text>
              <Text style={styles.notificationTime}>
                {new Date(notification.check_in_time).toLocaleTimeString('vi-VN')}
              </Text>
              {notification.warnings && notification.warnings.length > 0 && (
                <Text style={styles.warningText}>
                  ⚠️ {notification.warnings.join(', ')}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lớp học của bạn</Text>

        {loading ? (
          <View style={styles.center}>
            <Text>Đang tải...</Text>
          </View>
        ) : classes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Bạn chưa được phân công lớp nào</Text>
          </View>
        ) : (
          classes.map((classItem) => {
            const summary = attendanceSummary.find(s => s.class_id === classItem._id);

            return (
              <TouchableOpacity
                key={classItem._id}
                style={styles.classCard}
                onPress={() => handleClassPress(classItem)}
              >
                <View style={styles.classHeader}>
                  <Text style={styles.className}>{classItem.class_name}</Text>
                  <Text style={styles.classCode}>{classItem.class_code}</Text>
                </View>

                <Text style={styles.studentCount}>
                  {classItem.student_count || classItem.students.length} học sinh
                </Text>

                {summary && (
                  <View style={styles.attendanceSummary}>
                    <Text style={styles.attendanceText}>
                      Hôm nay: {summary.present_today}/{summary.total_students} có mặt
                    </Text>
                    <Text style={styles.attendanceText}>
                      Vắng: {summary.absent_today}
                    </Text>
                  </View>
                )}

                <View style={styles.schedulePreview}>
                  <Text style={styles.scheduleText}>Lịch học:</Text>
                  {classItem.schedule.slice(0, 2).map((schedule: any, index: number) => (
                    <Text key={index} style={styles.scheduleItem}>
                      • {schedule.day}: {schedule.start_time}-{schedule.end_time} ({schedule.room})
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quản lý</Text>

        <TouchableOpacity style={styles.managementCard}>
          <Text style={styles.managementTitle}>📊 Báo cáo điểm danh</Text>
          <Text style={styles.managementDescription}>
            Xem thống kê điểm danh chi tiết cho tất cả lớp học
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.managementCard}>
          <Text style={styles.managementTitle}>📝 Quản lý tài liệu</Text>
          <Text style={styles.managementDescription}>
            Upload và quản lý tài liệu cho các lớp học
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.managementCard}>
          <Text style={styles.managementTitle}>👥 Quản lý sinh viên</Text>
          <Text style={styles.managementDescription}>
            Thêm/xóa sinh viên khỏi lớp học
          </Text>
        </TouchableOpacity>

        {/* Real-time Notifications Section */}
        {recentNotifications.length > 0 && (
          <View style={styles.notificationsSection}>
            <Text style={styles.notificationsTitle}>📢 Điểm danh gần đây</Text>
            {recentNotifications.slice(0, 5).map((notification, index) => (
              <View key={index} style={styles.notificationItem}>
                <Text style={styles.notificationText}>
                  <Text style={styles.studentName}>{notification.student_name}</Text>
                  {" - "}
                  <Text style={[
                    styles.statusText,
                    notification.status === 'present' && styles.statusSuccess,
                    notification.status !== 'present' && styles.statusError
                  ]}>
                    {notification.message}
                  </Text>
                </Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.check_in_time).toLocaleTimeString('vi-VN')}
                </Text>
              </View>
            ))}
          </View>
        )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  welcome: {
    fontSize: 24,
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
  classCard: {
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
  classCode: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  studentCount: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
  },
  attendanceSummary: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  attendanceText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  schedulePreview: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 10,
  },
  scheduleText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  scheduleItem: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
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
  notificationCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationWarning: {
    borderLeftColor: "#FF9800",
  },
  notificationText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 14,
    color: "#666",
  },
  warningText: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "500",
    marginTop: 4,
  },
});
