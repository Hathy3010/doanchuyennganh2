import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL } from '../config/api';

const { width, height } = Dimensions.get('window');

interface LivenessIndicators {
  blink_detected: boolean;
  blink_count: number;
  mouth_movement_detected: boolean;
  mouth_movement_count: number;
  head_movement_detected: boolean;
  head_movement_count: number;
}

interface LivenessResponse {
  face_detected: boolean;
  liveness_score: number;
  indicators: LivenessIndicators;
  pose: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  guidance: string;
  status: 'liveness_verified' | 'no_liveness' | 'no_face' | 'error';
  error?: string;
}

interface LivenessDetectorProps {
  onLivenessStatusChange?: (status: LivenessResponse) => void;
  onLivenessVerified?: () => void;
  autoCapture?: boolean;
}

export default function LivenessDetector({
  onLivenessStatusChange,
  onLivenessVerified,
  autoCapture = true,
}: LivenessDetectorProps) {
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [indicators, setIndicators] = useState<LivenessIndicators>({
    blink_detected: false,
    blink_count: 0,
    mouth_movement_detected: false,
    mouth_movement_count: 0,
    head_movement_detected: false,
    head_movement_count: 0,
  });
  const [guidance, setGuidance] = useState('Vui lòng nhìn vào camera');
  const [status, setStatus] = useState<LivenessResponse['status']>('no_face');
  const [frameIndex, setFrameIndex] = useState(0);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, []);

  // Start continuous frame capture
  useEffect(() => {
    if (!permission?.granted || !autoCapture) {
      return;
    }

    // Capture frames every 500ms (2 FPS for liveness detection)
    frameIntervalRef.current = setInterval(() => {
      captureAndAnalyzeFrame();
    }, 500);

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [permission?.granted, autoCapture]);

  const captureAndAnalyzeFrame = async () => {
    if (!cameraRef.current || isAnalyzing) {
      return;
    }

    try {
      setIsAnalyzing(true);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo.base64) {
        // Clean base64 - remove data URI prefix if present
        let cleanBase64 = photo.base64;
        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }

        // Send to backend for liveness analysis
        const response = await fetch(`${API_URL}/detect_liveness`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64: cleanBase64,
            frame_index: frameIndex,
            timestamp: Date.now(),
          }),
        });

        if (response.ok) {
          const result: LivenessResponse = await response.json();

          // Update state with liveness analysis
          setLivenessScore(result.liveness_score);
          setIndicators(result.indicators);
          setGuidance(result.guidance);
          setStatus(result.status);
          setFrameIndex(frameIndex + 1);

          // Notify parent component
          if (onLivenessStatusChange) {
            onLivenessStatusChange(result);
          }

          // Trigger callback when liveness is verified
          if (result.status === 'liveness_verified' && onLivenessVerified) {
            onLivenessVerified();
          }
        } else {
          console.error('Liveness detection error:', response.status);
          setStatus('error');
        }
      }
    } catch (error) {
      console.error('Error capturing/analyzing frame:', error);
      setStatus('error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
      </View>
    );
  }

  // Determine border color based on status
  const getBorderColor = () => {
    switch (status) {
      case 'liveness_verified':
        return '#4CAF50'; // Green
      case 'no_liveness':
      case 'no_face':
        return '#FF6B6B'; // Red
      case 'error':
        return '#FF6B6B'; // Red
      default:
        return '#999999'; // Gray
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cameraContainer,
          { borderColor: getBorderColor() },
        ]}
      >
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />

        {/* Loading indicator */}
        {isAnalyzing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Status overlay */}
        <View style={styles.statusOverlay}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Liveness Score</Text>
            <Text style={styles.scoreValue}>
              {(livenessScore * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Indicators display */}
      <View style={styles.indicatorsContainer}>
        <View style={styles.indicatorRow}>
          <View
            style={[
              styles.indicator,
              indicators.blink_detected && styles.indicatorActive,
            ]}
          >
            <Text style={styles.indicatorLabel}>👁️ Blink</Text>
            <Text style={styles.indicatorCount}>{indicators.blink_count}</Text>
          </View>

          <View
            style={[
              styles.indicator,
              indicators.mouth_movement_detected && styles.indicatorActive,
            ]}
          >
            <Text style={styles.indicatorLabel}>😊 Smile</Text>
            <Text style={styles.indicatorCount}>
              {indicators.mouth_movement_count}
            </Text>
          </View>

          <View
            style={[
              styles.indicator,
              indicators.head_movement_detected && styles.indicatorActive,
            ]}
          >
            <Text style={styles.indicatorLabel}>🔄 Head</Text>
            <Text style={styles.indicatorCount}>
              {indicators.head_movement_count}
            </Text>
          </View>
        </View>
      </View>

      {/* Guidance message */}
      <View style={styles.guidanceContainer}>
        <Text style={styles.guidanceText}>{guidance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    borderWidth: 3,
    borderRadius: 10,
    overflow: 'hidden',
    margin: 10,
  },
  camera: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  scoreValue: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
  },
  indicatorsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  indicator: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
  },
  indicatorActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  indicatorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  indicatorCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  guidanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 20,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  guidanceText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
});
