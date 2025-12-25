/**
 * Note Editor Component
 * Modal for creating and editing notes with character counter.
 * 
 * Requirements: 5.1, 5.2
 */

import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useEffect } from "react";

interface NoteEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  initialContent?: string;
  isEditing?: boolean;
  maxLength?: number;
}

export default function NoteEditor({
  visible,
  onClose,
  onSave,
  initialContent = "",
  isEditing = false,
  maxLength = 1000,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, visible]);

  const handleSave = () => {
    if (content.trim()) {
      onSave(content.trim());
      setContent("");
    }
  };

  const handleClose = () => {
    setContent("");
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
            <Text style={styles.title}>
              {isEditing ? "✏️ Sửa ghi chú" : "📝 Thêm ghi chú"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          <TextInput
            style={styles.input}
            placeholder="Nhập ghi chú của bạn..."
            placeholderTextColor="#999"
            value={content}
            onChangeText={(text) => setContent(text.slice(0, maxLength))}
            multiline
            autoFocus
            maxLength={maxLength}
          />

          {/* Character counter */}
          <View style={styles.footer}>
            <Text style={[
              styles.charCount,
              content.length >= maxLength * 0.9 && styles.charCountWarning
            ]}>
              {content.length}/{maxLength}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!content.trim()}
            >
              <Text style={styles.saveButtonText}>
                {isEditing ? "Cập nhật" : "Lưu"}
              </Text>
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
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
    padding: 5,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 15,
    minHeight: 150,
    maxHeight: 250,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    color: "#333",
  },
  footer: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: "#999",
  },
  charCountWarning: {
    color: "#FF9800",
  },
  actions: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
});
