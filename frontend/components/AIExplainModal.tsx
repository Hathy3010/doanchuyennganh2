/**
 * AI Explain Modal Component
 * Shows AI-generated explanations with follow-up question support.
 * 
 * Requirements: 6.1, 6.4, 6.5, 6.6, 6.7
 */

import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";

interface AIExplainModalProps {
  visible: boolean;
  onClose: () => void;
  highlightedText: string;
  explanation: string;
  loading: boolean;
  onAskFollowup: (question: string) => Promise<void>;
  onSaveExplanation?: () => void;
}

export default function AIExplainModal({
  visible,
  onClose,
  highlightedText,
  explanation,
  loading,
  onAskFollowup,
  onSaveExplanation,
}: AIExplainModalProps) {
  const [followupQuestion, setFollowupQuestion] = useState("");
  const [askingFollowup, setAskingFollowup] = useState(false);

  const handleAskFollowup = async () => {
    if (!followupQuestion.trim()) return;
    
    setAskingFollowup(true);
    try {
      await onAskFollowup(followupQuestion);
      setFollowupQuestion("");
    } finally {
      setAskingFollowup(false);
    }
  };

  const handleClose = () => {
    setFollowupQuestion("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🤖 AI Giải thích</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Highlighted text */}
          {highlightedText && (
            <View style={styles.highlightedSection}>
              <Text style={styles.highlightedLabel}>Đoạn văn bản:</Text>
              <Text style={styles.highlightedText} numberOfLines={3}>
                "{highlightedText}"
              </Text>
            </View>
          )}

          {/* Explanation content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Đang phân tích...</Text>
                <Text style={styles.loadingSubtext}>AI đang tìm hiểu ngữ cảnh</Text>
              </View>
            ) : explanation ? (
              <Text style={styles.explanationText}>{explanation}</Text>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>😕</Text>
                <Text style={styles.errorText}>Không thể lấy giải thích</Text>
                <Text style={styles.errorSubtext}>Hãy hỏi giáo viên của bạn để được giải đáp</Text>
              </View>
            )}
          </ScrollView>

          {/* Follow-up question */}
          {!loading && explanation && (
            <View style={styles.followupSection}>
              <Text style={styles.followupLabel}>Hỏi thêm:</Text>
              <View style={styles.followupInputContainer}>
                <TextInput
                  style={styles.followupInput}
                  placeholder="Nhập câu hỏi của bạn..."
                  placeholderTextColor="#999"
                  value={followupQuestion}
                  onChangeText={setFollowupQuestion}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, (!followupQuestion.trim() || askingFollowup) && styles.sendButtonDisabled]}
                  onPress={handleAskFollowup}
                  disabled={!followupQuestion.trim() || askingFollowup}
                >
                  {askingFollowup ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.sendButtonText}>Gửi</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {onSaveExplanation && explanation && !loading && (
              <TouchableOpacity style={styles.saveButton} onPress={onSaveExplanation}>
                <Text style={styles.saveButtonText}>💾 Lưu giải thích</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.closeActionButton} onPress={handleClose}>
              <Text style={styles.closeActionButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
    padding: 5,
  },
  highlightedSection: {
    backgroundColor: "#FFF9C4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  highlightedLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  highlightedText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#333",
  },
  content: {
    maxHeight: 250,
    marginBottom: 15,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: "#666",
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#333",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  followupSection: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 15,
    marginBottom: 15,
  },
  followupLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  followupInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  followupInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 80,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sendButtonText: {
    color: "white",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    color: "#4CAF50",
    fontWeight: "600",
  },
  closeActionButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  closeActionButtonText: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },
});
