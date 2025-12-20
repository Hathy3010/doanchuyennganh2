import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { API_URL } from "../config/api";

export default function RegisterUserScreen() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: "student" as "student" | "teacher",
    studentId: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    // Validation
    if (!formData.username.trim() || !formData.email.trim() || !formData.password || !formData.fullName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (formData.role === "student" && !formData.studentId.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã sinh viên");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.fullName.trim(),
          role: formData.role,
          student_id: formData.role === "student" ? formData.studentId.trim() : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Thành công", "Đăng ký tài khoản thành công!", [
          {
            text: "Đăng nhập",
            onPress: () => router.replace("/login")
          }
        ]);
      } else {
        Alert.alert("Lỗi", data.detail || "Đăng ký thất bại");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.registerCard}>
        <Text style={styles.title}>Đăng ký tài khoản</Text>

        <TextInput
          style={styles.input}
          placeholder="Tên đăng nhập *"
          value={formData.username}
          onChangeText={(value) => updateFormData("username", value)}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Email *"
          value={formData.email}
          onChangeText={(value) => updateFormData("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Họ và tên *"
          value={formData.fullName}
          onChangeText={(value) => updateFormData("fullName", value)}
          autoCorrect={false}
        />

        <View style={styles.roleContainer}>
          <Text style={styles.label}>Vai trò:</Text>
          <View style={styles.roleButtons}>
            <TouchableOpacity
              style={[styles.roleButton, formData.role === "student" && styles.roleButtonActive]}
              onPress={() => updateFormData("role", "student")}
            >
              <Text style={[styles.roleButtonText, formData.role === "student" && styles.roleButtonTextActive]}>
                Sinh viên
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, formData.role === "teacher" && styles.roleButtonActive]}
              onPress={() => updateFormData("role", "teacher")}
            >
              <Text style={[styles.roleButtonText, formData.role === "teacher" && styles.roleButtonTextActive]}>
                Giảng viên
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {formData.role === "student" && (
          <TextInput
            style={styles.input}
            placeholder="Mã sinh viên *"
            value={formData.studentId}
            onChangeText={(value) => updateFormData("studentId", value)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Mật khẩu *"
          value={formData.password}
          onChangeText={(value) => updateFormData("password", value)}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu *"
          value={formData.confirmPassword}
          onChangeText={(value) => updateFormData("confirmPassword", value)}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button
          title={loading ? "Đang đăng ký..." : "Đăng ký"}
          onPress={handleRegister}
          disabled={loading}
        />

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.loginText}>Đã có tài khoản? Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  registerCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
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
  roleContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
  },
  roleButtons: {
    flexDirection: "row",
    gap: 10,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    alignItems: "center",
  },
  roleButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  roleButtonText: {
    fontSize: 16,
    color: "#666",
  },
  roleButtonTextActive: {
    color: "white",
    fontWeight: "bold",
  },
  loginLink: {
    marginTop: 20,
    alignItems: "center",
  },
  loginText: {
    color: "#007AFF",
    fontSize: 16,
  },
});
