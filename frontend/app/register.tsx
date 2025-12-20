import { View, Text, Button, Alert, TextInput, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";

import { API_URL } from "../config/api";

export default function RegisterScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [studentId, setStudentId] = useState("");
  const [processing, setProcessing] = useState(false);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text>Ứng dụng cần quyền camera</Text>
        <Button title="Cấp quyền" onPress={requestPermission} />
      </View>
    );
  }

  const registerFace = async () => {
    if (!studentId.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã sinh viên");
      return;
    }

    if (processing) return;
    setProcessing(true);

    try {
      if (!cameraRef.current) {
        Alert.alert("Lỗi", "Camera chưa sẵn sàng");
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      const response = await fetch(`${API_URL}/face/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          image: photo.base64,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        Alert.alert("Thành công", `Đăng ký FaceID thành công cho ${studentId}`);
      } else {
        Alert.alert("Thất bại", data.message || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Lỗi kết nối server");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          ref={cameraRef}
          facing="front"
        />
      </View>

      <View style={styles.controls}>
        <Text style={styles.title}>Đăng ký FaceID</Text>

        <TextInput
          style={styles.input}
          placeholder="Nhập mã sinh viên (VD: SV001)"
          value={studentId}
          onChangeText={setStudentId}
          autoCapitalize="characters"
        />

        <Button
          title={processing ? "Đang xử lý..." : "Đăng ký FaceID"}
          onPress={registerFace}
          disabled={processing}
        />

        <Text style={styles.note}>
          Hãy nhìn thẳng vào camera và đảm bảo khuôn mặt được chiếu sáng tốt
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraContainer: {
    height: 400,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'black'
  },
  camera: { flex: 1 },
  controls: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  title: { fontSize: 22, marginBottom: 20, fontWeight: 'bold' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    fontSize: 16
  },
  note: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20
  }
});
