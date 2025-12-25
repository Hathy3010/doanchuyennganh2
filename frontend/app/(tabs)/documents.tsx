/**
 * Document List Screen
 * Displays documents shared by teachers, grouped by class.
 * Supports search, filtering, and realtime updates via WebSocket.
 * 
 * Requirements: 7.1, 7.2, 7.4, 2.3
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, RefreshControl, Alert } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_URL, WS_URL } from "../../config/api";

interface Document {
  id: string;
  title: string;
  description: string;
  file_type: string;
  file_size: number;
  upload_time: string;
  view_count: number;
  class_id: string;
  class_name: string;
  teacher_name: string;
  is_new?: boolean;
  has_highlights?: boolean;
  has_notes?: boolean;
}

interface ClassGroup {
  class_id: string;
  class_name: string;
  documents: Document[];
}

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter();

  // Load documents from API
  const loadDocuments = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Get user profile first
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (!profileRes.ok) {
        if (profileRes.status === 401) {
          router.replace("/login");
        }
        return;
      }
      
      const profile = await profileRes.json();
      setUserId(profile.id || profile._id);

      // Get documents for all enrolled classes
      const classesRes = await fetch(`${API_URL}/student/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (!classesRes.ok) return;
      
      const dashboardData = await classesRes.json();
      const allDocuments: Document[] = [];
      const groups: ClassGroup[] = [];

      // Fetch documents for each class
      for (const classItem of dashboardData.today_schedule || []) {
        try {
          const docsRes = await fetch(
            `${API_URL}/documents/class/${classItem.class_id}?page=1&page_size=50`,
            { headers: { "Authorization": `Bearer ${token}` } }
          );

          if (docsRes.ok) {
            const docsData = await docsRes.json();
            const classDocs = (docsData.documents || []).map((doc: any) => ({
              ...doc,
              class_id: classItem.class_id,
              class_name: classItem.class_name,
              teacher_name: classItem.teacher_name,
            }));

            if (classDocs.length > 0) {
              groups.push({
                class_id: classItem.class_id,
                class_name: classItem.class_name,
                documents: classDocs,
              });
              allDocuments.push(...classDocs);
            }
          }
        } catch (err) {
          console.warn(`Failed to load docs for class ${classItem.class_id}:`, err);
        }
      }

      setDocuments(allDocuments);
      setClassGroups(groups);
    } catch (error) {
      console.error("Load documents error:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách tài liệu");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!userId) return;

    const ws = new WebSocket(`${WS_URL}/ws/documents/${userId}`);
    
    ws.onopen = () => {
      console.log("📡 Documents WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "document_shared") {
          // New document notification
          console.log("📄 New document shared:", data.title);
          
          // Show toast/alert
          Alert.alert(
            "📄 Tài liệu mới",
            `${data.teacher_name} đã chia sẻ "${data.title}" trong lớp ${data.class_name}`,
            [
              { text: "Xem sau", style: "cancel" },
              { 
                text: "Xem ngay", 
                onPress: () => router.push({
                  pathname: "/document-viewer",
                  params: { documentId: data.document_id }
                })
              }
            ]
          );

          // Refresh document list
          loadDocuments();
        }
      } catch (err) {
        console.warn("WebSocket message parse error:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("📡 Documents WebSocket disconnected");
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (userId) setupWebSocket();
      }, 5000);
    };

    wsRef.current = ws;
  }, [userId, loadDocuments, router]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (userId) {
      setupWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, setupWebSocket]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  // Filter documents based on search and class filter
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClass = !selectedClassId || doc.class_id === selectedClassId;
    
    return matchesSearch && matchesClass;
  });

  // Group filtered documents by class
  const filteredGroups = classGroups
    .map(group => ({
      ...group,
      documents: group.documents.filter(doc => 
        !searchQuery || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(group => 
      (!selectedClassId || group.class_id === selectedClassId) &&
      group.documents.length > 0
    );

  const handleDocumentPress = (doc: Document) => {
    router.push({
      pathname: "/document-viewer",
      params: { documentId: doc.id, title: doc.title }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType?.toLowerCase()) {
      case "pdf": return "📕";
      case "docx":
      case "doc": return "📘";
      case "txt": return "📄";
      case "md": return "📝";
      default: return "📎";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Đang tải tài liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 Tài liệu</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Tìm kiếm tài liệu..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Class Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !selectedClassId && styles.filterChipActive]}
          onPress={() => setSelectedClassId(null)}
        >
          <Text style={[styles.filterChipText, !selectedClassId && styles.filterChipTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        
        {classGroups.map(group => (
          <TouchableOpacity
            key={group.class_id}
            style={[styles.filterChip, selectedClassId === group.class_id && styles.filterChipActive]}
            onPress={() => setSelectedClassId(group.class_id)}
          >
            <Text style={[
              styles.filterChipText, 
              selectedClassId === group.class_id && styles.filterChipTextActive
            ]}>
              {group.class_name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document List */}
      <ScrollView
        style={styles.documentList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? "Không tìm thấy tài liệu" : "Chưa có tài liệu nào"}
            </Text>
          </View>
        ) : (
          filteredGroups.map(group => (
            <View key={group.class_id} style={styles.classSection}>
              <Text style={styles.classSectionTitle}>{group.class_name}</Text>
              
              {group.documents.map(doc => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.documentCard}
                  onPress={() => handleDocumentPress(doc)}
                >
                  <View style={styles.documentIcon}>
                    <Text style={styles.documentIconText}>{getFileTypeIcon(doc.file_type)}</Text>
                  </View>
                  
                  <View style={styles.documentInfo}>
                    <View style={styles.documentTitleRow}>
                      <Text style={styles.documentTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      {doc.is_new && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>MỚI</Text>
                        </View>
                      )}
                    </View>
                    
                    {doc.description && (
                      <Text style={styles.documentDescription} numberOfLines={2}>
                        {doc.description}
                      </Text>
                    )}
                    
                    <View style={styles.documentMeta}>
                      <Text style={styles.documentMetaText}>
                        {formatFileSize(doc.file_size)} • {formatDate(doc.upload_time)}
                      </Text>
                      <Text style={styles.documentMetaText}>
                        👁 {doc.view_count || 0}
                      </Text>
                    </View>

                    {/* Status badges */}
                    <View style={styles.statusBadges}>
                      {doc.has_highlights && (
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>🖍 Đã highlight</Text>
                        </View>
                      )}
                      {doc.has_notes && (
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>📝 Có ghi chú</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        
        <View style={{ height: 20 }} />
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
  searchContainer: {
    backgroundColor: "white",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  filterContainer: {
    backgroundColor: "white",
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 14,
    color: "#666",
  },
  filterChipTextActive: {
    color: "white",
    fontWeight: "600",
  },
  documentList: {
    flex: 1,
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
  },
  classSection: {
    marginTop: 15,
  },
  classSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#e8e8e8",
  },
  documentCard: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  documentIconText: {
    fontSize: 28,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  newBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  newBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  documentDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  documentMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  documentMetaText: {
    fontSize: 12,
    color: "#999",
  },
  statusBadges: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    color: "#4CAF50",
  },
});
