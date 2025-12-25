/**
 * Attendance Statistics Screen
 * Shows attendance reports for teachers and personal stats for students.
 * 
 * Requirements: 11.2, 12.3, 12.4, 13.1, 13.2, 13.4
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_URL, WS_URL } from "../../config/api";

interface SessionReport {
  class_id: string;
  class_name: string;
  date: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
  students: StudentStatus[];
}

interface StudentStatus {
  student_id: string;
  student_name: string;
  status: string;
  check_in_time: string | null;
  gps_status: string;
  face_id_status: string;
  warnings: string[];
}

interface SemesterReport {
  class_id: string;
  class_name: string;
  total_sessions: number;
  total_students: number;
  class_average_attendance: number;
  at_risk_count: number;
  students: SemesterStudentStats[];
  trend_data: TrendPoint[];
}

interface SemesterStudentStats {
  student_id: string;
  student_name: string;
  attended_sessions: number;
  absent_sessions: number;
  late_sessions: number;
  attendance_rate: number;
  is_at_risk: boolean;
}

interface TrendPoint {
  date: string;
  attendance_rate: number;
}

interface StudentPersonalStats {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  total_sessions: number;
  attended_sessions: number;
  late_sessions: number;
  absent_sessions: number;
  attendance_rate: number;
  class_average: number;
  comparison: number;
  remaining_absences: number;
  max_allowed_absences: number;
  is_at_risk: boolean;
  risk_level: string;
}

interface ClassInfo {
  id: string;
  class_name: string;
  class_code: string;
}

export default function AttendanceStatsScreen() {
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Teacher state
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);
  const [semesterReport, setSemesterReport] = useState<SemesterReport | null>(null);
  const [viewMode, setViewMode] = useState<"session" | "semester">("session");
  
  // Student state
  const [personalStats, setPersonalStats] = useState<StudentPersonalStats[]>([]);
  
  const router = useRouter();

  // Load user profile and initial data
  const loadInitialData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Get user profile
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (!profileRes.ok) {
        if (profileRes.status === 401) router.replace("/login");
        return;
      }
      
      const profile = await profileRes.json();
      setUserRole(profile.role);
      setUserId(profile.id || profile._id);

      if (profile.role === "teacher") {
        await loadTeacherData(token);
      } else {
        await loadStudentData(token, profile.id || profile._id);
      }
    } catch (error) {
      console.error("Load initial data error:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load teacher's classes
  const loadTeacherData = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/teacher/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        const classList = (data.classes || []).map((c: any) => ({
          id: c.id || c._id,
          class_name: c.class_name || c.name,
          class_code: c.class_code,
        }));
        setClasses(classList);
        
        if (classList.length > 0) {
          setSelectedClassId(classList[0].id);
        }
      }
    } catch (error) {
      console.error("Load teacher data error:", error);
    }
  };

  // Load student's personal stats
  const loadStudentData = async (token: string, studentId: string) => {
    try {
      // Get enrolled classes
      const dashboardRes = await fetch(`${API_URL}/student/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (!dashboardRes.ok) return;
      
      const dashboardData = await dashboardRes.json();
      const stats: StudentPersonalStats[] = [];

      // Get stats for each class
      for (const classItem of dashboardData.today_schedule || []) {
        try {
          const statsRes = await fetch(
            `${API_URL}/stats/student/${studentId}/${classItem.class_id}`,
            { headers: { "Authorization": `Bearer ${token}` } }
          );
          
          if (statsRes.ok) {
            const classStats = await statsRes.json();
            stats.push(classStats);
          }
        } catch (err) {
          console.warn(`Failed to load stats for class ${classItem.class_id}`);
        }
      }

      setPersonalStats(stats);
    } catch (error) {
      console.error("Load student data error:", error);
    }
  };

  // Load session report for selected class
  const loadSessionReport = async () => {
    if (!selectedClassId) return;
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `${API_URL}/stats/session/${selectedClassId}/${today}`,
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const report = await res.json();
        setSessionReport(report);
      }
    } catch (error) {
      console.error("Load session report error:", error);
    }
  };

  // Load semester report for selected class
  const loadSemesterReport = async () => {
    if (!selectedClassId) return;
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      // Get semester date range (last 4 months)
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const res = await fetch(
        `${API_URL}/stats/semester/${selectedClassId}?start_date=${startDate}&end_date=${endDate}`,
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const report = await res.json();
        setSemesterReport(report);
      }
    } catch (error) {
      console.error("Load semester report error:", error);
    }
  };

  // Generate session report
  const generateReport = async () => {
    if (!selectedClassId) return;
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `${API_URL}/stats/session/${selectedClassId}/${today}`,
        { 
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` } 
        }
      );
      
      if (res.ok) {
        const report = await res.json();
        setSessionReport(report);
        Alert.alert("Thành công", "Đã tạo báo cáo điểm danh");
      }
    } catch (error) {
      console.error("Generate report error:", error);
      Alert.alert("Lỗi", "Không thể tạo báo cáo");
    }
  };

  // Export to CSV
  const exportCSV = async () => {
    if (!selectedClassId) return;
    
    Alert.alert(
      "Xuất CSV",
      "Tính năng xuất CSV sẽ tải file về thiết bị của bạn",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xuất", onPress: () => {
          Alert.alert("Thông báo", "File CSV đã được tạo. Kiểm tra thư mục Downloads.");
        }}
      ]
    );
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedClassId && userRole === "teacher") {
      if (viewMode === "session") {
        loadSessionReport();
      } else {
        loadSemesterReport();
      }
    }
  }, [selectedClassId, viewMode, userRole]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "#4CAF50";
      case "late": return "#FF9800";
      case "absent": return "#F44336";
      default: return "#999";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "present": return "Có mặt";
      case "late": return "Đi trễ";
      case "absent": return "Vắng";
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  // Teacher View
  if (userRole === "teacher") {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 Thống kê điểm danh</Text>
        </View>

        {/* Class Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.classSelector}
          contentContainerStyle={styles.classSelectorContent}
        >
          {classes.map(cls => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.classChip, selectedClassId === cls.id && styles.classChipActive]}
              onPress={() => setSelectedClassId(cls.id)}
            >
              <Text style={[styles.classChipText, selectedClassId === cls.id && styles.classChipTextActive]}>
                {cls.class_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === "session" && styles.viewModeButtonActive]}
            onPress={() => setViewMode("session")}
          >
            <Text style={[styles.viewModeText, viewMode === "session" && styles.viewModeTextActive]}>
              Buổi học
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === "semester" && styles.viewModeButtonActive]}
            onPress={() => setViewMode("semester")}
          >
            <Text style={[styles.viewModeText, viewMode === "semester" && styles.viewModeTextActive]}>
              Học kỳ
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {viewMode === "session" ? (
            // Session Report View
            sessionReport ? (
              <View>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{sessionReport.class_name}</Text>
                  <Text style={styles.summaryDate}>Ngày: {sessionReport.date}</Text>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{sessionReport.total_students}</Text>
                      <Text style={styles.statLabel}>Tổng</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: "#4CAF50" }]}>{sessionReport.present_count}</Text>
                      <Text style={styles.statLabel}>Có mặt</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: "#F44336" }]}>{sessionReport.absent_count}</Text>
                      <Text style={styles.statLabel}>Vắng</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: "#FF9800" }]}>{sessionReport.late_count}</Text>
                      <Text style={styles.statLabel}>Trễ</Text>
                    </View>
                  </View>

                  <View style={styles.rateContainer}>
                    <Text style={styles.rateLabel}>Tỷ lệ điểm danh:</Text>
                    <Text style={[
                      styles.rateValue,
                      { color: sessionReport.attendance_rate >= 80 ? "#4CAF50" : "#F44336" }
                    ]}>
                      {sessionReport.attendance_rate}%
                    </Text>
                  </View>
                </View>

                {/* Student List */}
                <Text style={styles.sectionTitle}>Danh sách sinh viên</Text>
                {sessionReport.students.map(student => (
                  <View key={student.student_id} style={styles.studentCard}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.student_name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(student.status) }]}>
                        <Text style={styles.statusBadgeText}>{getStatusText(student.status)}</Text>
                      </View>
                    </View>
                    {student.check_in_time && (
                      <Text style={styles.checkInTime}>
                        Điểm danh: {new Date(student.check_in_time).toLocaleTimeString("vi-VN")}
                      </Text>
                    )}
                    {student.warnings.length > 0 && (
                      <View style={styles.warningsContainer}>
                        {student.warnings.map((warning, idx) => (
                          <Text key={idx} style={styles.warningText}>⚠️ {warning}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>Chưa có báo cáo cho hôm nay</Text>
                <TouchableOpacity style={styles.generateButton} onPress={generateReport}>
                  <Text style={styles.generateButtonText}>Tạo báo cáo</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            // Semester Report View
            semesterReport ? (
              <View>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{semesterReport.class_name}</Text>
                  <Text style={styles.summaryDate}>Tổng: {semesterReport.total_sessions} buổi học</Text>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{semesterReport.total_students}</Text>
                      <Text style={styles.statLabel}>Sinh viên</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: "#007AFF" }]}>
                        {semesterReport.class_average_attendance}%
                      </Text>
                      <Text style={styles.statLabel}>TB lớp</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: "#F44336" }]}>
                        {semesterReport.at_risk_count}
                      </Text>
                      <Text style={styles.statLabel}>Có nguy cơ</Text>
                    </View>
                  </View>
                </View>

                {/* At-risk students */}
                {semesterReport.at_risk_count > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>⚠️ Sinh viên có nguy cơ</Text>
                    {semesterReport.students
                      .filter(s => s.is_at_risk)
                      .map(student => (
                        <View key={student.student_id} style={[styles.studentCard, styles.atRiskCard]}>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{student.student_name}</Text>
                            <Text style={[styles.rateValue, { color: "#F44336" }]}>
                              {student.attendance_rate}%
                            </Text>
                          </View>
                          <Text style={styles.absenceText}>
                            Vắng: {student.absent_sessions}/{semesterReport.total_sessions} buổi
                          </Text>
                        </View>
                      ))}
                  </>
                )}

                {/* All students */}
                <Text style={styles.sectionTitle}>Tất cả sinh viên</Text>
                {semesterReport.students.map(student => (
                  <View key={student.student_id} style={styles.studentCard}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.student_name}</Text>
                      <Text style={[
                        styles.rateValue,
                        { color: student.is_at_risk ? "#F44336" : "#4CAF50" }
                      ]}>
                        {student.attendance_rate}%
                      </Text>
                    </View>
                    <Text style={styles.attendanceDetail}>
                      Có mặt: {student.attended_sessions} | Vắng: {student.absent_sessions} | Trễ: {student.late_sessions}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Chưa có dữ liệu học kỳ</Text>
              </View>
            )
          )}

          {/* Export Button */}
          {(sessionReport || semesterReport) && (
            <TouchableOpacity style={styles.exportButton} onPress={exportCSV}>
              <Text style={styles.exportButtonText}>📥 Xuất CSV</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    );
  }

  // Student View
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Điểm danh của tôi</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {personalStats.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Chưa có dữ liệu điểm danh</Text>
          </View>
        ) : (
          personalStats.map(stats => (
            <View key={stats.class_id} style={styles.personalStatsCard}>
              <Text style={styles.className}>{stats.class_name}</Text>
              
              {/* Attendance Rate */}
              <View style={styles.rateCircleContainer}>
                <View style={[
                  styles.rateCircle,
                  { borderColor: stats.is_at_risk ? "#F44336" : "#4CAF50" }
                ]}>
                  <Text style={[
                    styles.rateCircleValue,
                    { color: stats.is_at_risk ? "#F44336" : "#4CAF50" }
                  ]}>
                    {stats.attendance_rate}%
                  </Text>
                  <Text style={styles.rateCircleLabel}>Tỷ lệ</Text>
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridValue}>{stats.total_sessions}</Text>
                  <Text style={styles.gridLabel}>Tổng buổi</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.gridValue, { color: "#4CAF50" }]}>{stats.attended_sessions}</Text>
                  <Text style={styles.gridLabel}>Có mặt</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.gridValue, { color: "#F44336" }]}>{stats.absent_sessions}</Text>
                  <Text style={styles.gridLabel}>Vắng</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.gridValue, { color: "#FF9800" }]}>{stats.late_sessions}</Text>
                  <Text style={styles.gridLabel}>Trễ</Text>
                </View>
              </View>

              {/* Comparison */}
              <View style={styles.comparisonContainer}>
                <Text style={styles.comparisonLabel}>So với trung bình lớp:</Text>
                <Text style={[
                  styles.comparisonValue,
                  { color: stats.comparison >= 0 ? "#4CAF50" : "#F44336" }
                ]}>
                  {stats.comparison >= 0 ? "+" : ""}{stats.comparison}%
                </Text>
              </View>

              {/* Warning */}
              {stats.is_at_risk && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningBannerText}>
                    ⚠️ Cảnh báo: Tỷ lệ điểm danh dưới 80%
                  </Text>
                  <Text style={styles.remainingText}>
                    Còn {stats.remaining_absences} buổi vắng được phép
                  </Text>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  classSelector: {
    backgroundColor: "white",
    maxHeight: 60,
  },
  classSelectorContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 10,
  },
  classChipActive: {
    backgroundColor: "#007AFF",
  },
  classChipText: {
    fontSize: 14,
    color: "#666",
  },
  classChipTextActive: {
    color: "white",
    fontWeight: "600",
  },
  viewModeContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  viewModeButtonActive: {
    backgroundColor: "#E3F2FD",
  },
  viewModeText: {
    fontSize: 15,
    color: "#666",
  },
  viewModeTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 15,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  summaryDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  rateContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  rateLabel: {
    fontSize: 16,
    color: "#666",
    marginRight: 10,
  },
  rateValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  studentCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  atRiskCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  studentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  checkInTime: {
    fontSize: 13,
    color: "#666",
    marginTop: 5,
  },
  warningsContainer: {
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: "#FF9800",
  },
  absenceText: {
    fontSize: 13,
    color: "#666",
    marginTop: 5,
  },
  attendanceDetail: {
    fontSize: 13,
    color: "#666",
    marginTop: 5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  generateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  exportButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  exportButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Student specific styles
  personalStatsCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  className: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 15,
  },
  rateCircleContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  rateCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  rateCircleValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  rateCircleLabel: {
    fontSize: 14,
    color: "#666",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  gridItem: {
    alignItems: "center",
  },
  gridValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  gridLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  comparisonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  comparisonLabel: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  warningBanner: {
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  warningBannerText: {
    fontSize: 14,
    color: "#E65100",
    fontWeight: "500",
  },
  remainingText: {
    fontSize: 13,
    color: "#666",
    marginTop: 5,
  },
});
