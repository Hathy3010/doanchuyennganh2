/**
 * Document Viewer Screen
 * Displays document content with highlight and note capabilities.
 * Supports text selection, AI explanation, and reading position persistence.
 * 
 * Requirements: 3.1, 3.2, 3.4, 4.1, 4.3, 4.4, 4.5, 10.1, 10.3
 */

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_URL } from "../../config/api";
import { offlineManager } from "../../services/OfflineManager";
import wsManager, { WebSocketConnection } from "../../services/WebSocketManager";

interface Highlight {
  id: string;
  text_content: string;
  start_position: number;
  end_position: number;
  color: string;
  ai_explanation?: {
    content: string;
    generated_at: string;
  };
}

interface Note {
  id: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface DocumentData {
  id: string;
  title: string;
  description: string;
  content: string;
  file_type: string;
  teacher_name: string;
  class_name: string;
}

const HIGHLIGHT_COLORS = [
  { name: "yellow", color: "#FFEB3B", label: "Vàng" },
  { name: "green", color: "#4CAF50", label: "Xanh lá" },
  { name: "blue", color: "#2196F3", label: "Xanh dương" },
  { name: "red", color: "#F44336", label: "Đỏ" },
];

export default function DocumentViewerScreen() {
  const { documentId, title } = useLocalSearchParams<{ documentId: string; title: string }>();
  const router = useRouter();
  
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [content, setContent] = useState<string>("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingPosition, setReadingPosition] = useState(0);
  
  // Selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectionStart] = useState(0);
  const [selectionEnd] = useState(0);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  
  // Offline state
  const [isOnline, setIsOnline] = useState(true);
  const [wsStatus, setWsStatus] = useState<string>("disconnected");
  
  // AI Explanation modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplanation, setAIExplanation] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [currentHighlightId, setCurrentHighlightId] = useState<string | null>(null);
  const [followupQuestion, setFollowupQuestion] = useState("");
  
  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notePosition, setNotePosition] = useState(0);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const wsConnectionRef = useRef<WebSocketConnection | null>(null);

  // Load document data
  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // Check if online
      const online = offlineManager.getIsOnline();
      setIsOnline(online);

      // Try to load from cache first if offline
      if (!online) {
        const cachedDoc = await offlineManager.getCachedDocument(documentId);
        if (cachedDoc) {
          setDocument({
            id: cachedDoc.id,
            title: cachedDoc.title,
            description: "",
            content: cachedDoc.content,
            file_type: cachedDoc.file_type,
            teacher_name: "",
            class_name: "",
          });
          setContent(cachedDoc.content);
          setLoading(false);
          return;
        }
      }

      // Get document details
      const docRes = await fetch(`${API_URL}/documents/${documentId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (!docRes.ok) {
        Alert.alert("Lỗi", "Không thể tải tài liệu");
        return;
      }
      
      const docData = await docRes.json();
      setDocument(docData);

      // Get document content
      const contentRes = await fetch(`${API_URL}/documents/${documentId}/content`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (contentRes.ok) {
        const contentData = await contentRes.json();
        const docContent = contentData.content || "";
        setContent(docContent);

        // Cache document for offline use
        await offlineManager.cacheDocument({
          id: documentId,
          title: docData.title,
          content: docContent,
          file_type: docData.file_type,
          cached_at: new Date().toISOString(),
          size_bytes: 0,
        });
      }

      // Get highlights
      const highlightsRes = await fetch(`${API_URL}/highlights/document/${documentId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (highlightsRes.ok) {
        const highlightsData = await highlightsRes.json();
        setHighlights(highlightsData.highlights || []);
      }

      // Get notes
      const notesRes = await fetch(`${API_URL}/notes/document/${documentId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.notes || []);
      }

      // Track view
      await fetch(`${API_URL}/documents/${documentId}/view`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reading_position: 0 })
      });

      // Load saved reading position
      const savedPosition = await AsyncStorage.getItem(`reading_position_${documentId}`);
      if (savedPosition) {
        setReadingPosition(parseInt(savedPosition, 10));
      }

    } catch (error) {
      console.error("Load document error:", error);
      
      // Try to load from cache on error
      const cachedDoc = await offlineManager.getCachedDocument(documentId);
      if (cachedDoc) {
        setDocument({
          id: cachedDoc.id,
          title: cachedDoc.title,
          description: "",
          content: cachedDoc.content,
          file_type: cachedDoc.file_type,
          teacher_name: "",
          class_name: "",
        });
        setContent(cachedDoc.content);
      } else {
        Alert.alert("Lỗi", "Không thể tải tài liệu");
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  // Setup WebSocket for document room
  const setupWebSocket = useCallback(async () => {
    if (!documentId) return;

    const connection = await wsManager.connectDocuments((data) => {
      console.log("Document WS message:", data.type);
    });

    if (connection) {
      wsConnectionRef.current = connection;
      
      // Join document room
      connection.send({
        type: "join_document",
        document_id: documentId
      });
    }
  }, [documentId]);

  // Setup network listener
  useEffect(() => {
    const unsubscribe = offlineManager.addNetworkListener((online) => {
      setIsOnline(online);
      if (online) {
        // Sync offline queue when back online
        offlineManager.syncOfflineQueue();
      }
    });

    // Add WebSocket status listener
    const unsubscribeWs = wsManager.addStatusListener((endpoint, status) => {
      if (endpoint === "/ws/documents") {
        setWsStatus(status);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeWs();
    };
  }, []);

  useEffect(() => {
    loadDocument();
    setupWebSocket();

    return () => {
      if (wsConnectionRef.current) {
        wsConnectionRef.current.send({
          type: "leave_document",
          document_id: documentId
        });
      }
    };
  }, [loadDocument, setupWebSocket, documentId]);

  // Save reading position on scroll
  const handleScroll = async (event: any) => {
    const position = event.nativeEvent.contentOffset.y;
    setReadingPosition(position);
    
    // Debounce save
    await AsyncStorage.setItem(`reading_position_${documentId}`, position.toString());
    
    // Update server
    const token = await AsyncStorage.getItem("access_token");
    if (token) {
      fetch(`${API_URL}/documents/${documentId}/view`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reading_position: Math.floor(position) })
      }).catch(() => {});
    }
  };

  // Restore reading position
  useEffect(() => {
    if (readingPosition > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: readingPosition, animated: true });
      }, 500);
    }
  }, [content, readingPosition]);

  // Create highlight
  const createHighlight = async (color: string) => {
    if (!selectedText || !documentId) return;
    
    // If offline, queue the action
    if (!isOnline) {
      await offlineManager.addToQueue("highlight", "create", {
        document_id: documentId,
        text_content: selectedText,
        start_position: selectionStart,
        end_position: selectionEnd,
        color: color,
      });
      
      // Add to local state optimistically
      const tempHighlight: Highlight = {
        id: `temp_${Date.now()}`,
        text_content: selectedText,
        start_position: selectionStart,
        end_position: selectionEnd,
        color: color,
      };
      setHighlights(prev => [...prev, tempHighlight]);
      setShowHighlightMenu(false);
      setSelectedText("");
      Alert.alert("Đã lưu", "Highlight sẽ được đồng bộ khi có mạng");
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/highlights?document_id=${documentId}&text_content=${encodeURIComponent(selectedText)}&start_position=${selectionStart}&end_position=${selectionEnd}&color=${color}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        const newHighlight = await res.json();
        setHighlights(prev => [...prev, newHighlight]);
        setShowHighlightMenu(false);
        setSelectedText("");
      } else {
        Alert.alert("Lỗi", "Không thể tạo highlight");
      }
    } catch (error) {
      console.error("Create highlight error:", error);
      Alert.alert("Lỗi", "Không thể tạo highlight");
    }
  };

  // Delete highlight
  const deleteHighlight = async (highlightId: string) => {
    // If offline, queue the action
    if (!isOnline) {
      await offlineManager.addToQueue("highlight", "delete", {
        highlight_id: highlightId,
      });
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
      Alert.alert("Đã xóa", "Thay đổi sẽ được đồng bộ khi có mạng");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/highlights/${highlightId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        setHighlights(prev => prev.filter(h => h.id !== highlightId));
      }
    } catch (error) {
      console.error("Delete highlight error:", error);
    }
  };

  // Get AI explanation
  const getAIExplanation = async (highlightId: string) => {
    setCurrentHighlightId(highlightId);
    setAILoading(true);
    setShowAIModal(true);
    setAIExplanation("");

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/highlights/${highlightId}/explain`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAIExplanation(data.explanation || data.content || "Không có giải thích");
      } else {
        setAIExplanation("Không thể lấy giải thích. Hãy hỏi giáo viên của bạn.");
      }
    } catch (error) {
      console.error("AI explanation error:", error);
      setAIExplanation("Lỗi kết nối. Hãy hỏi giáo viên của bạn.");
    } finally {
      setAILoading(false);
    }
  };

  // Ask follow-up question
  const askFollowup = async () => {
    if (!followupQuestion.trim() || !currentHighlightId) return;
    
    setAILoading(true);
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/highlights/${currentHighlightId}/followup?question=${encodeURIComponent(followupQuestion)}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAIExplanation(prev => prev + "\n\n---\n\n**Câu hỏi:** " + followupQuestion + "\n\n**Trả lời:** " + (data.answer || data.content || ""));
        setFollowupQuestion("");
      }
    } catch (error) {
      console.error("Followup error:", error);
    } finally {
      setAILoading(false);
    }
  };

  // Create/Update note
  const saveNote = async () => {
    if (!noteContent.trim() || !documentId) return;
    
    // If offline, queue the action
    if (!isOnline) {
      if (editingNoteId) {
        await offlineManager.addToQueue("note", "update", {
          note_id: editingNoteId,
          content: noteContent,
        });
        setNotes(prev => prev.map(n => 
          n.id === editingNoteId 
            ? { ...n, content: noteContent, updated_at: new Date().toISOString() }
            : n
        ));
      } else {
        await offlineManager.addToQueue("note", "create", {
          document_id: documentId,
          content: noteContent,
          position: notePosition,
        });
        const tempNote: Note = {
          id: `temp_${Date.now()}`,
          content: noteContent,
          position: notePosition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setNotes(prev => [...prev, tempNote]);
      }
      
      setShowNoteModal(false);
      setNoteContent("");
      setEditingNoteId(null);
      Alert.alert("Đã lưu", "Ghi chú sẽ được đồng bộ khi có mạng");
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      if (editingNoteId) {
        // Update existing note
        const res = await fetch(`${API_URL}/notes/${editingNoteId}?content=${encodeURIComponent(noteContent)}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (res.ok) {
          const updatedNote = await res.json();
          setNotes(prev => prev.map(n => n.id === editingNoteId ? updatedNote : n));
        }
      } else {
        // Create new note
        const res = await fetch(`${API_URL}/notes?document_id=${documentId}&content=${encodeURIComponent(noteContent)}&position=${notePosition}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (res.ok) {
          const newNote = await res.json();
          setNotes(prev => [...prev, newNote]);
        }
      }

      setShowNoteModal(false);
      setNoteContent("");
      setEditingNoteId(null);
    } catch (error) {
      console.error("Save note error:", error);
      Alert.alert("Lỗi", "Không thể lưu ghi chú");
    }
  };

  // Delete note
  const deleteNote = async (noteId: string) => {
    // If offline, queue the action
    if (!isOnline) {
      await offlineManager.addToQueue("note", "delete", {
        note_id: noteId,
      });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      Alert.alert("Đã xóa", "Thay đổi sẽ được đồng bộ khi có mạng");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/notes/${noteId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error("Delete note error:", error);
    }
  };

  // Render content with highlights
  const renderContent = () => {
    if (!content) return null;

    // Sort highlights by position
    const sortedHighlights = [...highlights].sort((a, b) => a.start_position - b.start_position);
    
    const elements: React.ReactElement[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, idx) => {
      // Add text before highlight
      if (highlight.start_position > lastIndex) {
        elements.push(
          <Text key={`text-${idx}`} style={styles.contentText}>
            {content.substring(lastIndex, highlight.start_position)}
          </Text>
        );
      }

      // Add highlighted text
      const highlightColor = HIGHLIGHT_COLORS.find(c => c.name === highlight.color)?.color || "#FFEB3B";
      elements.push(
        <TouchableOpacity
          key={`highlight-${highlight.id}`}
          onPress={() => {
            Alert.alert(
              "Highlight",
              highlight.text_content,
              [
                { text: "Đóng", style: "cancel" },
                { text: "🤖 AI Giải thích", onPress: () => getAIExplanation(highlight.id) },
                { text: "📝 Ghi chú", onPress: () => {
                  setNotePosition(highlight.start_position);
                  setShowNoteModal(true);
                }},
                { text: "🗑 Xóa", style: "destructive", onPress: () => deleteHighlight(highlight.id) },
              ]
            );
          }}
        >
          <Text style={[styles.highlightedText, { backgroundColor: highlightColor }]}>
            {highlight.text_content}
          </Text>
        </TouchableOpacity>
      );

      lastIndex = highlight.end_position;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      elements.push(
        <Text key="text-end" style={styles.contentText}>
          {content.substring(lastIndex)}
        </Text>
      );
    }

    return elements.length > 0 ? elements : (
      <Text style={styles.contentText}>{content}</Text>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải tài liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || document?.title || "Tài liệu"}
        </Text>
      </View>

      {/* Document Info */}
      {document && (
        <View style={styles.docInfo}>
          <Text style={styles.docInfoText}>
            📚 {document.class_name} • 👨‍🏫 {document.teacher_name}
          </Text>
        </View>
      )}

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <View style={styles.contentWrapper}>
          {renderContent()}
        </View>

        {/* Notes indicators */}
        {notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesSectionTitle}>📝 Ghi chú của bạn ({notes.length})</Text>
            {notes.map(note => (
              <TouchableOpacity
                key={note.id}
                style={styles.noteCard}
                onPress={() => {
                  Alert.alert(
                    "Ghi chú",
                    note.content,
                    [
                      { text: "Đóng", style: "cancel" },
                      { text: "✏️ Sửa", onPress: () => {
                        setEditingNoteId(note.id);
                        setNoteContent(note.content);
                        setShowNoteModal(true);
                      }},
                      { text: "🗑 Xóa", style: "destructive", onPress: () => deleteNote(note.id) },
                    ]
                  );
                }}
              >
                <Text style={styles.noteContent} numberOfLines={3}>{note.content}</Text>
                <Text style={styles.noteDate}>
                  {new Date(note.created_at).toLocaleDateString("vi-VN")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button - Add Note */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNotePosition(Math.floor(readingPosition));
          setShowNoteModal(true);
        }}
      >
        <Text style={styles.fabText}>📝</Text>
      </TouchableOpacity>

      {/* Highlight Menu Modal */}
      <Modal visible={showHighlightMenu} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setShowHighlightMenu(false)}
        >
          <View style={styles.highlightMenu}>
            <Text style={styles.highlightMenuTitle}>Chọn màu highlight</Text>
            <View style={styles.colorPicker}>
              {HIGHLIGHT_COLORS.map(c => (
                <TouchableOpacity
                  key={c.name}
                  style={[styles.colorOption, { backgroundColor: c.color }]}
                  onPress={() => createHighlight(c.name)}
                >
                  <Text style={styles.colorLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AI Explanation Modal */}
      <Modal visible={showAIModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.aiModal}>
            <View style={styles.aiModalHeader}>
              <Text style={styles.aiModalTitle}>🤖 AI Giải thích</Text>
              <TouchableOpacity onPress={() => setShowAIModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.aiContent}>
              {aiLoading ? (
                <View style={styles.aiLoading}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.aiLoadingText}>Đang phân tích...</Text>
                </View>
              ) : (
                <Text style={styles.aiExplanationText}>{aiExplanation}</Text>
              )}
            </ScrollView>

            {/* Follow-up question */}
            <View style={styles.followupContainer}>
              <TextInput
                style={styles.followupInput}
                placeholder="Hỏi thêm..."
                value={followupQuestion}
                onChangeText={setFollowupQuestion}
                multiline
              />
              <TouchableOpacity 
                style={styles.followupButton}
                onPress={askFollowup}
                disabled={aiLoading || !followupQuestion.trim()}
              >
                <Text style={styles.followupButtonText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.noteModal}>
            <View style={styles.noteModalHeader}>
              <Text style={styles.noteModalTitle}>
                {editingNoteId ? "✏️ Sửa ghi chú" : "📝 Thêm ghi chú"}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowNoteModal(false);
                setNoteContent("");
                setEditingNoteId(null);
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Nhập ghi chú của bạn (tối đa 1000 ký tự)..."
              value={noteContent}
              onChangeText={(text) => setNoteContent(text.slice(0, 1000))}
              multiline
              maxLength={1000}
            />

            <Text style={styles.charCount}>{noteContent.length}/1000</Text>

            <TouchableOpacity 
              style={styles.saveNoteButton}
              onPress={saveNote}
              disabled={!noteContent.trim()}
            >
              <Text style={styles.saveNoteButtonText}>Lưu ghi chú</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  docInfo: {
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  docInfoText: {
    fontSize: 14,
    color: "#666",
  },
  contentContainer: {
    flex: 1,
  },
  contentWrapper: {
    padding: 20,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#333",
  },
  highlightedText: {
    fontSize: 16,
    lineHeight: 26,
    paddingHorizontal: 2,
    borderRadius: 3,
  },
  notesSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginTop: 20,
  },
  notesSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  noteCard: {
    backgroundColor: "#FFF9C4",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  noteContent: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: "#999",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  highlightMenu: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "80%",
  },
  highlightMenuTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 15,
  },
  colorPicker: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  aiModal: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
  },
  aiModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  aiModalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
  },
  aiContent: {
    maxHeight: 300,
  },
  aiLoading: {
    alignItems: "center",
    padding: 40,
  },
  aiLoadingText: {
    marginTop: 10,
    color: "#666",
  },
  aiExplanationText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#333",
  },
  followupContainer: {
    flexDirection: "row",
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 15,
  },
  followupInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 80,
  },
  followupButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  followupButtonText: {
    color: "white",
    fontWeight: "600",
  },
  noteModal: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "90%",
    padding: 20,
  },
  noteModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  noteInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 15,
    minHeight: 150,
    textAlignVertical: "top",
    fontSize: 15,
  },
  charCount: {
    textAlign: "right",
    color: "#999",
    marginTop: 5,
    fontSize: 12,
  },
  saveNoteButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 15,
  },
  saveNoteButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
