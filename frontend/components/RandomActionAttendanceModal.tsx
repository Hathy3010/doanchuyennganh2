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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
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
  const [phase, setPhase] = useState<'init' | 'selecting' | 'detecting' | 'antifraud' | 'recording' | 'result' | 'gps_invalid'>('init');
  const [cameraReady, setCameraReady] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  
  // Result state for displaying check-in result
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    message: string;
    validations?: any;
    gpsDistance?: number;
    faceScore?: number;
  } | null>(null);

  // GPS Invalid State
  const [gpsInvalidState, setGpsInvalidState] = useState<{
    isGPSInvalid: boolean;
    distance: number;
    attemptNumber: number;
    remainingAttempts: number;
    maxAttemptsReached: boolean;
  }>({
    isGPSInvalid: false,
    distance: 0,
    attemptNumber: 0,
    remainingAttempts: 2,
    maxAttemptsReached: false,
  });

  // Camera permission
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

  // ============ Initialize Permissions ============
  useEffect(() => {
    if (visible) {
      initializePermissions();
    } else {
      // Reset state when modal closes
      setPhase('init');
      setRetryCount(0);
      setDetectionMessage('');
      setGpsStatus('checking');
      setCheckInResult(null);
      setGpsInvalidState({
        isGPSInvalid: false,
        distance: 0,
        attemptNumber: 0,
        remainingAttempts: 2,
        maxAttemptsReached: false,
      });
      setValidations({
        liveness: { is_valid: false, message: '⏳ Đang kiểm tra...' },
        deepfake: { is_valid: false, message: '⏳ Đang kiểm tra...' },
        gps: { is_valid: false, message: '⏳ Đang kiểm tra...' },
        embedding: { is_valid: false, message: '⏳ Đang kiểm tra...' },
      });
    }
  }, [visible]);

  const initializePermissions = async () => {
    try {
      setPhase('init');
      setDetectionMessage('🔄 Đang kiểm tra quyền truy cập...');

      // Request camera permission
      if (!cameraPermission?.granted) {
        const camResult = await requestCameraPermission();
        if (!camResult.granted) {
          Alert.alert('Lỗi', 'Cần quyền camera để điểm danh');
          onClose();
          return;
        }
      }

      // Request location permission
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        setGpsStatus('denied');
        Alert.alert('Lỗi', 'Cần quyền vị trí để điểm danh');
        onClose();
        return;
      }
      setGpsStatus('granted');

      // Get current location
      setDetectionMessage('📍 Đang lấy vị trí...');
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        gpsRef.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        console.log('✅ GPS location:', gpsRef.current);
        setDetectionMessage('✅ Đã lấy vị trí thành công');
      } catch (locError) {
        console.warn('⚠️ GPS error, using default:', locError);
        // Use default location for testing
        gpsRef.current = {
          latitude: 16.0544,
          longitude: 108.2022,
        };
        setDetectionMessage('⚠️ Sử dụng vị trí mặc định');
      }

      // Ready to capture
      setPhase('selecting');
      setDetectionMessage('📸 Sẵn sàng điểm danh');
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert('Lỗi', 'Không thể khởi tạo quyền truy cập');
      onClose();
    }
  };

  // ============ PHASE 3: Anti-Fraud Checks ============
  const performAntifraudChecks = useCallback(async (frameBase64: string) => {
    try {
      setPhase('antifraud');
      setIsLoading(true);
      setDetectionMessage('🛡️ Đang xác minh khuôn mặt...');

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn');
        onClose();
        return;
      }

      // Use GPS location already obtained during initialization
      if (!gpsRef.current) {
        Alert.alert('Lỗi', 'Không có thông tin vị trí');
        onClose();
        return;
      }

      console.log('📍 Using GPS location:', gpsRef.current);
      setDetectionMessage('🔍 Đang xác minh Face ID...');

      // Call backend endpoint for check-in with face verification
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
        const errorText = await checkInResponse.text();
        console.error('❌ Check-in error:', errorText);
        
        // Parse error to show specific validation failure
        let errorMessage = 'Điểm danh thất bại';
        let errorType = 'unknown';
        let errorDetails: any = null;
        
        try {
          const errorJson = JSON.parse(errorText);
          // Handle structured error response
          if (errorJson.detail && typeof errorJson.detail === 'object') {
            errorMessage = errorJson.detail.message || errorMessage;
            errorType = errorJson.detail.error_type || 'unknown';
            errorDetails = errorJson.detail.details || null;
          } else {
            errorMessage = errorJson.detail || errorMessage;
          }
        } catch {
          // Use default message
        }

        // Handle GPS-invalid error specifically
        if (errorType === 'gps_invalid' || errorType === 'gps_invalid_max_attempts') {
          const isMaxReached = errorType === 'gps_invalid_max_attempts';
          const distance = errorDetails?.distance_meters || 0;
          const remaining = errorDetails?.remaining_attempts || 0;
          const attemptNum = errorDetails?.attempt_number || 0;
          
          setGpsInvalidState({
            isGPSInvalid: true,
            distance: distance,
            attemptNumber: attemptNum,
            remainingAttempts: remaining,
            maxAttemptsReached: isMaxReached,
          });
          
          // Update GPS validation status
          setValidations(prev => ({
            ...prev,
            gps: { is_valid: false, message: `❌ Vị trí không hợp lệ (${distance}m)` },
            embedding: { is_valid: true, message: '✅ Face ID hợp lệ' },
          }));
          
          setPhase('gps_invalid');
          setDetectionMessage(errorMessage);
          
          if (isMaxReached) {
            // Max attempts reached - show alert and close
            Alert.alert(
              '❌ Hết lượt thử',
              'Bạn đã hết số lần thử điểm danh với GPS không hợp lệ hôm nay. Vui lòng thử lại vào ngày mai.',
              [{ text: 'OK', onPress: onClose }]
            );
          }
          return;
        }

        // Handle face-invalid error
        if (errorType === 'face_invalid') {
          setValidations(prev => ({
            ...prev,
            embedding: { is_valid: false, message: errorMessage },
          }));
        }

        setDetectionMessage(`❌ ${errorMessage}`);

        // Allow retry for non-max-attempts errors
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setPhase('selecting');
            setDetectionMessage(`⚠️ ${errorMessage}\nNhấn "Chụp ảnh" để thử lại (${retryCount + 1}/3)`);
          }, 2000);
        } else {
          Alert.alert('Lỗi', 'Vượt quá số lần thử. Vui lòng thử lại sau.');
          onClose();
        }
        return;
      }

      const result = await checkInResponse.json();
      console.log('✅ Check-in successful:', result);

      // Update validations
      if (result.validations) {
        setValidations(result.validations);
      }
      
      // Set result for display
      setCheckInResult({
        success: true,
        message: result.message || '✅ Điểm danh thành công!',
        validations: result.validations,
        gpsDistance: result.validations?.gps?.distance_meters,
        faceScore: result.validations?.face?.similarity_score,
      });
      
      setPhase('result');
      setDetectionMessage('✅ Điểm danh thành công!');
      Vibration.vibrate([100, 100, 100]);
    } catch (error) {
      console.error('❌ Anti-fraud check error:', error);
      setDetectionMessage(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown'}`);
      
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setPhase('selecting');
        }, 2000);
      } else {
        Alert.alert('Lỗi', 'Vượt quá số lần thử. Vui lòng thử lại sau.');
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  }, [classItem, retryCount, onSuccess, onClose]);

  // ============ Capture Photo ============
  const capturePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert('Lỗi', 'Camera chưa sẵn sàng');
        return;
      }

      if (!gpsRef.current) {
        Alert.alert('Lỗi', 'Chưa lấy được vị trí GPS');
        return;
      }

      setPhase('detecting');
      setDetectionMessage('📸 Đang chụp ảnh...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        throw new Error('Không thể chụp ảnh');
      }

      // Clean base64
      let cleanBase64 = photo.base64;
      if (photo.base64.startsWith('data:')) {
        const commaIdx = photo.base64.indexOf(',');
        if (commaIdx !== -1) {
          cleanBase64 = photo.base64.slice(commaIdx + 1);
        }
      }

      Vibration.vibrate(100);
      setPhase('antifraud');
      await performAntifraudChecks(cleanBase64);
    } catch (error) {
      console.error('❌ Photo capture error:', error);
      setDetectionMessage(`❌ Lỗi chụp ảnh: ${error instanceof Error ? error.message : 'Unknown'}`);
      setPhase('selecting');
    }
  }, [performAntifraudChecks]);

  // ============ Render ============
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>📍 Điểm danh Face ID</Text>
            {classItem && (
              <Text style={styles.subtitle}>
                {classItem.class_name} • {classItem.start_time} - {classItem.end_time}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Camera Circle Container */}
          <View style={styles.cameraCircleContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              onCameraReady={() => setCameraReady(true)}
            />
            <View style={styles.cameraMask}>
              <View style={styles.cameraMaskHole} />
            </View>
          </View>

          {/* Status Messages */}
          <View style={styles.statusContainer}>
            {/* Init Phase */}
            {phase === 'init' && (
              <View style={styles.messageBox}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.messageText}>{detectionMessage || '🔄 Đang khởi tạo...'}</Text>
              </View>
            )}

            {/* Selecting Phase */}
            {phase === 'selecting' && (
              <View style={styles.messageBox}>
                <Text style={styles.instructionText}>📸 Nhìn thẳng vào camera</Text>
                {gpsRef.current && (
                  <Text style={styles.gpsText}>
                    📍 GPS: {gpsRef.current.latitude.toFixed(4)}, {gpsRef.current.longitude.toFixed(4)}
                  </Text>
                )}
                {detectionMessage && (
                  <Text style={[styles.statusText, detectionMessage.includes('❌') && styles.errorText]}>
                    {detectionMessage}
                  </Text>
                )}
                {retryCount > 0 && (
                  <Text style={styles.retryText}>Lần thử: {retryCount}/3</Text>
                )}
              </View>
            )}

            {/* Detecting Phase */}
            {phase === 'detecting' && (
              <View style={styles.messageBox}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.messageText}>{detectionMessage || '📸 Đang chụp ảnh...'}</Text>
              </View>
            )}

            {/* Antifraud Phase */}
            {phase === 'antifraud' && (
              <View style={styles.messageBox}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.messageText}>{detectionMessage}</Text>
                
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
                    label="Face ID"
                    status={validations.embedding.is_valid}
                    message={validations.embedding.message}
                  />
                </View>
              </View>
            )}

            {/* Recording Phase */}
            {phase === 'recording' && (
              <View style={styles.messageBox}>
                <Text style={styles.successText}>✅ Điểm danh thành công!</Text>
                <Text style={styles.messageText}>{detectionMessage}</Text>
              </View>
            )}

            {/* Result Phase - Detailed Result Display */}
            {phase === 'result' && checkInResult && (
              <View style={[styles.messageBox, checkInResult.success ? styles.resultSuccessBox : styles.resultErrorBox]}>
                <Text style={checkInResult.success ? styles.resultSuccessTitle : styles.resultErrorTitle}>
                  {checkInResult.success ? '✅ Điểm danh thành công!' : '❌ Điểm danh thất bại'}
                </Text>
                
                {/* Validation Details */}
                <View style={styles.resultDetails}>
                  {checkInResult.faceScore !== undefined && (
                    <View style={styles.resultDetailRow}>
                      <Text style={styles.resultDetailLabel}>🔐 Face ID:</Text>
                      <Text style={styles.resultDetailValue}>
                        {(checkInResult.faceScore * 100).toFixed(0)}% khớp
                      </Text>
                    </View>
                  )}
                  {checkInResult.gpsDistance !== undefined && (
                    <View style={styles.resultDetailRow}>
                      <Text style={styles.resultDetailLabel}>📍 Khoảng cách:</Text>
                      <Text style={styles.resultDetailValue}>
                        {checkInResult.gpsDistance}m
                      </Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.resultMessage}>{checkInResult.message}</Text>
              </View>
            )}

            {/* GPS Invalid Phase */}
            {phase === 'gps_invalid' && (
              <View style={[styles.messageBox, styles.gpsInvalidBox]}>
                <Text style={styles.gpsInvalidTitle}>⚠️ GPS Không Hợp Lệ</Text>
                <Text style={styles.gpsInvalidDistance}>
                  Bạn cách trường {gpsInvalidState.distance}m
                </Text>
                <Text style={styles.gpsInvalidFaceValid}>
                  ✅ Face ID đã xác minh thành công
                </Text>
                {!gpsInvalidState.maxAttemptsReached ? (
                  <View style={styles.gpsInvalidRetryInfo}>
                    <Text style={styles.gpsInvalidAttempt}>
                      Lần thử: {gpsInvalidState.attemptNumber}/2
                    </Text>
                    <Text style={styles.gpsInvalidRemaining}>
                      Còn {gpsInvalidState.remainingAttempts} lần thử
                    </Text>
                  </View>
                ) : (
                  <View style={styles.gpsInvalidMaxReached}>
                    <Text style={styles.gpsInvalidMaxText}>
                      ❌ Đã hết số lần thử hôm nay
                    </Text>
                    <Text style={styles.gpsInvalidMaxSubtext}>
                      Vui lòng thử lại vào ngày mai
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {phase === 'selecting' && (
              <TouchableOpacity
                style={[styles.captureButton, (!cameraReady || isLoading) && styles.captureButtonDisabled]}
                onPress={capturePhoto}
                disabled={!cameraReady || isLoading}
              >
                <Text style={styles.captureButtonText}>
                  {isLoading ? '⏳ Đang xử lý...' : '📸 Chụp ảnh'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* GPS Invalid - Retry Button */}
            {phase === 'gps_invalid' && !gpsInvalidState.maxAttemptsReached && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setPhase('selecting');
                  setDetectionMessage('📸 Sẵn sàng thử lại');
                }}
              >
                <Text style={styles.retryButtonText}>🔄 Thử lại</Text>
              </TouchableOpacity>
            )}
            
            {/* Result Phase - Done Button */}
            {phase === 'result' && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => {
                  onSuccess();
                  onClose();
                }}
              >
                <Text style={styles.doneButtonText}>✓ Hoàn tất</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={onClose}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
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
  // Header
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 50,
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
  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Camera Circle
  cameraCircleContainer: {
    width: 264,
    height: 264,
    borderRadius: 132,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 20,
  },
  cameraMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraMaskHole: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // Status Container
  statusContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  messageBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  gpsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#FF3B30',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 10,
  },
  retryText: {
    fontSize: 14,
    color: '#FF9500',
    marginTop: 8,
    fontWeight: '500',
  },
  // Validation Box
  validationBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    width: '100%',
  },
  validationItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  validationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  validationMessage: {
    fontSize: 12,
    color: '#666',
  },
  validSuccess: {
    color: '#34C759',
    fontWeight: '600',
  },
  validPending: {
    color: '#FFD60A',
  },
  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  captureButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 20,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  // GPS Invalid Phase Styles
  gpsInvalidBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  gpsInvalidTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
  },
  gpsInvalidDistance: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  gpsInvalidFaceValid: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 16,
  },
  gpsInvalidRetryInfo: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  gpsInvalidAttempt: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '600',
  },
  gpsInvalidRemaining: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  gpsInvalidMaxReached: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  gpsInvalidMaxText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  gpsInvalidMaxSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  retryButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Result Phase Styles
  resultSuccessBox: {
    backgroundColor: '#F0FFF4',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  resultErrorBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  resultSuccessTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 16,
  },
  resultErrorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 16,
  },
  resultDetails: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  resultDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  resultDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resultDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  doneButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 180,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
