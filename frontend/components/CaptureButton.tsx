import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';

interface CaptureButtonProps {
  livenessScore: number;
  livenessThreshold?: number;
  onCapture: () => void;
  isCapturing?: boolean;
  disabled?: boolean;
  label?: string;
}

export default function CaptureButton({
  livenessScore,
  livenessThreshold = 0.6,
  onCapture,
  isCapturing = false,
  disabled = false,
  label = 'Chụp ảnh',
}: CaptureButtonProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(0.5)).current;

  // Update enabled state based on liveness score
  useEffect(() => {
    const newIsEnabled = livenessScore >= livenessThreshold && !disabled;
    setIsEnabled(newIsEnabled);

    // Animate when enabled
    if (newIsEnabled) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [livenessScore, livenessThreshold, disabled]);

  const getButtonColor = () => {
    if (isCapturing) {
      return '#FF9800'; // Orange when capturing
    }
    if (isEnabled) {
      return '#4CAF50'; // Green when enabled
    }
    return '#CCCCCC'; // Gray when disabled
  };

  const getButtonText = () => {
    if (isCapturing) {
      return 'Đang chụp...';
    }
    if (!isEnabled) {
      return `${label} (${(livenessScore * 100).toFixed(0)}%)`;
    }
    return label;
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.buttonWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: getButtonColor(),
            },
            !isEnabled && styles.buttonDisabled,
            isCapturing && styles.buttonCapturing,
          ]}
          onPress={onCapture}
          disabled={!isEnabled || isCapturing}
          activeOpacity={isEnabled ? 0.8 : 1}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              !isEnabled && styles.buttonTextDisabled,
            ]}
          >
            {getButtonText()}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isEnabled ? '#4CAF50' : '#FF6B6B',
            },
          ]}
        />
        <Text style={styles.statusText}>
          {isEnabled
            ? 'Sẵn sàng chụp ảnh'
            : `Cần ${(livenessThreshold * 100).toFixed(0)}% liveness (hiện ${(livenessScore * 100).toFixed(0)}%)`}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${Math.min(livenessScore * 100, 100)}%`,
              backgroundColor: isEnabled ? '#4CAF50' : '#FF9800',
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  buttonWrapper: {
    marginBottom: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonCapturing: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonTextDisabled: {
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});
