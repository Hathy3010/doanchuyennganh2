import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions } from "react-native";
import { useState, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_URL } from "../config/api";

const { width, height } = Dimensions.get('window');

export default function SetupFaceIDScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  const steps = [
    { instruction: "Hướng mặt về phía trước", angle: "Front" },
    { instruction: "Quay mặt sang trái 45°", angle: "Left 45°" },
    { instruction: "Quay mặt sang phải 45°", angle: "Right 45°" },
    { instruction: "Ngửa mặt lên trên", angle: "Up" },
    { instruction: "Cúi mặt xuống dưới", angle: "Down" }
  ];

  if (!permission) {
    return <View style={styles.center}><Text>Checking permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Cần quyền truy cập camera để thiết lập FaceID</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || processing) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo.base64) {
        const newImages = [...images, photo.base64];
        setImages(newImages);

        if (step < steps.length - 1) {
          setStep(step + 1);
        } else {
          // All photos taken, process them
          await processFaceIDSetup(newImages);
        }
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chụp ảnh");
    }
  };

  const processFaceIDSetup = async (capturedImages: string[]) => {
    setProcessing(true);

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Lỗi", "Không tìm thấy token xác thực");
        return;
      }

      const response = await fetch(`${API_URL}/student/setup-faceid`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(capturedImages),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Thành công", "FaceID đã được thiết lập!", [
          {
            text: "OK",
            onPress: () => router.replace("/student")
          }
        ]);
      } else {
        Alert.alert("Lỗi", data.detail || "Không thể thiết lập FaceID");
        // Reset to try again
        setImages([]);
        setStep(0);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Lỗi kết nối server");
      setImages([]);
      setStep(0);
    } finally {
      setProcessing(false);
    }
  };

  const skipStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const resetSetup = () => {
    setImages([]);
    setStep(0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thiết lập FaceID</Text>
        <Text style={styles.subtitle}>
          Bước {step + 1} / {steps.length}
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />

        {/* Overlay guide */}
        <View style={styles.overlay}>
          <View style={styles.faceGuide}>
            <Text style={styles.guideText}>{steps[step].instruction}</Text>
            <Text style={styles.angleText}>{steps[step].angle}</Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= step && styles.progressDotActive
              ]}
            />
          ))}
        </View>

        <Text style={styles.instruction}>
          {step < steps.length - 1
            ? `Chụp ảnh theo hướng dẫn, sau đó nhấn "Tiếp theo"`
            : "Chụp ảnh cuối cùng để hoàn thành thiết lập"
          }
        </Text>

        <View style={styles.buttonContainer}>
          {step < steps.length - 1 ? (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={skipStep}
              >
                <Text style={styles.secondaryButtonText}>Bỏ qua</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={takePhoto}
              >
                <Text style={styles.primaryButtonText}>Chụp ảnh</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={resetSetup}
              >
                <Text style={styles.secondaryButtonText}>Chụp lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, processing && styles.buttonDisabled]}
                onPress={takePhoto}
                disabled={processing}
              >
                <Text style={styles.primaryButtonText}>
                  {processing ? "Đang xử lý..." : "Hoàn thành"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#ccc",
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  faceGuide: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 200,
  },
  guideText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 8,
  },
  angleText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  controls: {
    backgroundColor: "white",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: "#007AFF",
  },
  instruction: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  permissionText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
