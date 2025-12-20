import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";

import { API_URL } from "../config/api";

interface Document {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export default function ClassDetailScreen() {
  const { classId, className } = useLocalSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadDocuments = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/student/class/${classId}/documents`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else if (response.status === 401) {
        await AsyncStorage.removeItem("access_token");
        router.replace("/login");
      } else {
        Alert.alert("Lỗi", "Không thể tải tài liệu");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  };

  const openDocument = async (doc: Document) => {
    try {
      const supported = await Linking.canOpenURL(doc.file_url);
      if (supported) {
        await Linking.openURL(doc.file_url);
      } else {
        Alert.alert("Lỗi", "Không thể mở file này");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể mở tài liệu");
    }
  };

  useEffect(() => {
    loadDocuments();
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
        <Text style={styles.sectionTitle}>Tài liệu môn học</Text>

        {loading ? (
          <View style={styles.center}>
            <Text>Đang tải...</Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Chưa có tài liệu nào được chia sẻ</Text>
          </View>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentCard}
              onPress={() => openDocument(doc)}
            >
              <View style={styles.documentHeader}>
                <Text style={styles.documentTitle}>{doc.title}</Text>
                <Text style={styles.documentDate}>
                  {new Date(doc.uploaded_at).toLocaleDateString('vi-VN')}
                </Text>
              </View>

              {doc.description && (
                <Text style={styles.documentDescription}>{doc.description}</Text>
              )}

              <View style={styles.documentFooter}>
                <Text style={styles.downloadText}>📎 Nhấn để xem/mở tài liệu</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin bổ sung</Text>

        <TouchableOpacity style={styles.infoCard}>
          <Text style={styles.infoTitle}>📊 Điểm danh</Text>
          <Text style={styles.infoDescription}>
            Xem lịch sử điểm danh và thống kê của bạn
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoCard}>
          <Text style={styles.infoTitle}>📝 Bài tập</Text>
          <Text style={styles.infoDescription}>
            Xem và nộp bài tập của môn học
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoCard}>
          <Text style={styles.infoTitle}>💬 Thảo luận</Text>
          <Text style={styles.infoDescription}>
            Tham gia thảo luận với giảng viên và bạn học
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
  documentCard: {
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
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  documentDate: {
    fontSize: 14,
    color: "#666",
  },
  documentDescription: {
    fontSize: 16,
    color: "#666",
    marginBottom: 15,
    lineHeight: 22,
  },
  documentFooter: {
    alignItems: "center",
  },
  downloadText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
  },
  infoCard: {
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
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
});
