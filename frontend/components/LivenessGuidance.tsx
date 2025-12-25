import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface LivenessGuidanceProps {
  status: 'liveness_verified' | 'no_liveness' | 'no_face' | 'error';
  guidance: string;
  livenessScore: number;
  indicators: {
    blink_detected: boolean;
    blink_count: number;
    mouth_movement_detected: boolean;
    mouth_movement_count: number;
    head_movement_detected: boolean;
    head_movement_count: number;
  };
}

export default function LivenessGuidance({
  status,
  guidance,
  livenessScore,
  indicators,
}: LivenessGuidanceProps) {
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

  // Determine background color based on status
  const getBackgroundColor = () => {
    switch (status) {
      case 'liveness_verified':
        return '#E8F5E9'; // Light green
      case 'no_liveness':
      case 'no_face':
        return '#FFEBEE'; // Light red
      case 'error':
        return '#FFEBEE'; // Light red
      default:
        return '#F5F5F5'; // Light gray
    }
  };

  // Determine status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'liveness_verified':
        return '✅';
      case 'no_liveness':
      case 'no_face':
        return '❌';
      case 'error':
        return '⚠️';
      default:
        return '⏳';
    }
  };

  // Determine status text
  const getStatusText = () => {
    switch (status) {
      case 'liveness_verified':
        return 'Xác minh thành công';
      case 'no_liveness':
        return 'Chưa xác minh liveness';
      case 'no_face':
        return 'Không tìm thấy khuôn mặt';
      case 'error':
        return 'Lỗi xác minh';
      default:
        return 'Đang phân tích...';
    }
  };

  return (
    <View style={styles.container}>
      {/* Status header */}
      <View
        style={[
          styles.statusHeader,
          { backgroundColor: getBackgroundColor(), borderColor: getBorderColor() },
        ]}
      >
        <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          <Text style={styles.scoreText}>
            Điểm: {(livenessScore * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Guidance message */}
      <View style={styles.guidanceBox}>
        <Text style={styles.guidanceTitle}>Hướng dẫn</Text>
        <Text style={styles.guidanceMessage}>{guidance}</Text>
      </View>

      {/* Indicators display */}
      <View style={styles.indicatorsBox}>
        <Text style={styles.indicatorsTitle}>Chỉ báo phát hiện</Text>
        <View style={styles.indicatorsGrid}>
          {/* Blink indicator */}
          <View
            style={[
              styles.indicatorItem,
              indicators.blink_detected && styles.indicatorItemActive,
            ]}
          >
            <Text style={styles.indicatorEmoji}>👁️</Text>
            <Text style={styles.indicatorName}>Nhắm mắt</Text>
            <Text style={styles.indicatorValue}>{indicators.blink_count}</Text>
          </View>

          {/* Mouth movement indicator */}
          <View
            style={[
              styles.indicatorItem,
              indicators.mouth_movement_detected && styles.indicatorItemActive,
            ]}
          >
            <Text style={styles.indicatorEmoji}>😊</Text>
            <Text style={styles.indicatorName}>Cười</Text>
            <Text style={styles.indicatorValue}>
              {indicators.mouth_movement_count}
            </Text>
          </View>

          {/* Head movement indicator */}
          <View
            style={[
              styles.indicatorItem,
              indicators.head_movement_detected && styles.indicatorItemActive,
            ]}
          >
            <Text style={styles.indicatorEmoji}>🔄</Text>
            <Text style={styles.indicatorName}>Quay đầu</Text>
            <Text style={styles.indicatorValue}>
              {indicators.head_movement_count}
            </Text>
          </View>
        </View>
      </View>

      {/* Visual feedback border */}
      <View
        style={[
          styles.feedbackBorder,
          { borderColor: getBorderColor() },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  guidanceBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  guidanceMessage: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontWeight: '500',
  },
  indicatorsBox: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  indicatorsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  indicatorsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  indicatorItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  indicatorItemActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  indicatorEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  indicatorName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  indicatorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  feedbackBorder: {
    height: 3,
    borderRadius: 2,
    borderWidth: 1,
    marginTop: 8,
  },
});
