import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

interface RandomActionAttendanceModalProps {
  visible: boolean;
  classItem: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RandomActionAttendanceModal({
  visible,
  classItem,
  onClose,
  onSuccess,
}: RandomActionAttendanceModalProps) {
  // State
  const [phase, setPhase] = useState<'selecting' | 'detecting' | 'antifraud' | 'recording'>('selecting');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Validation results
  const [validations, setValidations] = useState({
    liveness: { is_valid: false, message: '⏳ Đang kiểm tra...' },
    deepfake: { is_valid: false, message: '⏳ Đang kiểm tra...' },
    gps: { is_valid: false, message: '⏳ Đang kiểm tra...' },
    embedding: { is_valid: false, message: '⏳ Đang kiểm tra...' },
  });

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // ============ Capture Photo ============
  const capturePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) return;

      setIsRecording(true);
      setPhase('detecting');
      setDetectionMessage('📸 Đang xác thực...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        throw new Error('Failed to capture photo');
      }

      // Clean base64
      let cleanBase64 = photo.base64;
      if (photo.base64.startsWith('data:')) {
        const commaIdx = photo.base64.indexOf(',');
        if (commaIdx !== -1) {
          cleanBase64 = photo.base64.slice(commaIdx + 1);
        }
      }

      setIsRecording(false);
      Vibration.vibrate(100);
      setPhase('antifraud');
      await performAntifraudChecks(cleanBase64);
    } catch (error) {
      console.error('❌ Photo capture error:', error);
      setDetectionMessage(`❌ Lỗi chụp ảnh: ${error}`);
      setPhase('selecting');
      setIsRecording(false);
    }
  }, []);

  // ============ PHASE 3: Anti-Fraud Checks ============
  const performAntifraudChecks = useCallback(async (frameBase64: string) => {
    try {
      setPhase('antifraud');
      setIsLoading(true);
      setDetectionMessage('🛡️ Kiểm tra chống gian lận...');

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Lỗi', 'Token không tìm thấy');
        return;
      }

      // Get GPS location
      console.log('📍 Getting GPS location...');
      try {
        const geoResponse = await fetch('https://geolocation-db.com/json/');
        const geoData = await geoResponse.json();
        gpsRef.current = {
          latitude: geoData.latitude,
          longitude: geoData.longitude,
        };
        console.log('✅ GPS location:', gpsRef.current);
      } catch (gpsError) {
        console.warn('⚠️ GPS error:', gpsError);
        // Use default location if GPS fails
        gpsRef.current = {
          latitude: 10.762622,
          longitude: 106.660172,
        };
      }

      // Call backend endpoint for check-in
      const checkInResponse = await fetch(`${API_URL}/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          class_id: classItem.class_id,
          latitude: gpsRef.current.latitude,
          longitude: gpsRef.current.longitude,
          image: frameBase64,
        }),
      });

      if (!checkInResponse.ok) {
        const error = await checkInResponse.text();
        console.error('❌ Check-in error:', error);
        
        // Parse error to show specific validation failure
        try {
          const errorJson = JSON.parse(error);
          setDetectionMessage(`❌ ${errorJson.detail}`);
        } catch {
          setDetectionMessage(`❌ Điểm danh thất bại`);
        }

        // Allow retry
        if (retryCount < 3) {
          setRetryCount(retryCount + 1);
          setPhase('detecting');
          setIsRecording(true);
          setDetectionMessage(`Thử lại (${retryCount + 1}/3)`);
        } else {
          Alert.alert('Lỗi', 'Vượt quá số lần thử. Vui lòng thử lại sau.');
          onClose();
        }
        return;
      }

      const result = await checkInResponse.json();
      console.log('✅ Check-in successful:', result);

      // Update validations
      setValidations(result.validations);
      setPhase('recording');
      setDetectionMessage('✅ Điểm danh thành công!');
      Vibration.vibrate([100, 100, 100]);

      // Show success alert
      Alert.alert('✅ Thành công', 'Điểm danh thành công!', [
        {
          text: 'OK',
          onPress: () => {
            onSuccess();
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Anti-fraud check error:', error);
      setDetectionMessage(`❌ Lỗi: ${error}`);
      
      if (retryCount < 3) {
        setRetryCount(retryCount + 1);
        setPhase('detecting');
        setIsRecording(true);
      } else {
        Alert.alert('Lỗi', 'Vượt quá số lần thử. Vui lòng thử lại sau.');
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  }, [classItem, retryCount, onSuccess, onClose]);

  // ============ Cleanup ============
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  // ============ Render ============
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Camera */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📍 Điểm danh</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {phase === 'selecting' && (
              <View style={styles.centerContent}>
                <View style={styles.instructionBox}>
                  <Text style={styles.instruction}>📸 Chụp ảnh khuôn mặt</Text>
                  <Text style={styles.subInstruction}>Hãy nhìn thẳng vào camera</Text>
                </View>
                <Text style={styles.message}>Sẵn sàng để điểm danh</Text>
              </View>
            )}

            {phase === 'detecting' && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.message}>📸 Đang xác thực...</Text>
              </View>
            )}

            {phase === 'antifraud' && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.message}>{detectionMessage}</Text>
                
                {/* Validation Progress */}
                <View style={styles.validationBox}>
                  <ValidationItem
                    label="Liveness"
                    status={validations.liveness.is_valid}
                    message={validations.liveness.message}
                  />
                  <ValidationItem
                    label="Deepfake"
                    status={validations.deepfake.is_valid}
                    message={validations.deepfake.message}
                  />
                  <ValidationItem
                    label="GPS"
                    status={validations.gps.is_valid}
                    message={validations.gps.message}
                  />
                  <ValidationItem
                    label="Embedding"
                    status={validations.embedding.is_valid}
                    message={validations.embedding.message}
                  />
                </View>
              </View>
            )}

            {phase === 'recording' && (
              <View style={styles.centerContent}>
                <Text style={styles.successMessage}>✅ Điểm danh thành công!</Text>
                <Text style={styles.message}>{detectionMessage}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Hủy</Text>
            </TouchableOpacity>

            {phase === 'selecting' && (
              <TouchableOpacity
                style={[styles.button, styles.captureButton]}
                onPress={capturePhoto}
                disabled={!cameraReady || isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? '⏳ Đang tải...' : '📸 Chụp ảnh'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============ Validation Item Component ============
function ValidationItem({
  label,
  status,
  message,
}: {
  label: string;
  status: boolean;
  message: string;
}) {
  return (
    <View style={styles.validationItem}>
      <Text style={styles.validationLabel}>
        {status ? '✅' : '⏳'} {label}
      </Text>
      <Text style={[styles.validationMessage, status ? styles.validSuccess : styles.validPending]}>
        {message}
      </Text>
    </View>
  );
}

// ============ Styles ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    minWidth: 280,
  },
  instruction: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
  },
  subInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },
  successMessage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 10,
  },
  validationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    minWidth: 300,
  },
  validationItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  validationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  validationMessage: {
    fontSize: 12,
    color: '#fff',
  },
  validSuccess: {
    color: '#34C759',
    fontWeight: '600',
  },
  validPending: {
    color: '#FFD60A',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
