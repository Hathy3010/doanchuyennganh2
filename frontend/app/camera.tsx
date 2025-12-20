import { View, Text, Button, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Ứng dụng cần quyền camera</Text>
        <Button title="Cấp quyền" onPress={requestPermission} />
      </View>
    );
  }

const takePhoto = async () => {
  if (!cameraRef.current) return;

  const photo = await cameraRef.current.takePictureAsync({
    base64: true,
    quality: 0.6,
  });

  const res = await fetch("http://10.0.2.2:8000/attendance/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: "SV001",
      image: photo.base64,
    }),
  });

  const data = await res.json();
  Alert.alert("Kết quả", JSON.stringify(data));
};


  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} />
      <Button title="Chụp ảnh" onPress={takePhoto} />
    </View>
  );
}
