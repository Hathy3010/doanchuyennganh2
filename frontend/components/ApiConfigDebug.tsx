import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { Platform } from 'react-native';
import { API_URL, API_CONFIGS, testApiConnection } from '../config/api';

interface ApiConfigDebugProps {
  visible?: boolean;
}

export const ApiConfigDebug: React.FC<ApiConfigDebugProps> = ({ visible = __DEV__ }) => {
  const [customUrl, setCustomUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');

  useEffect(() => {
    if (visible) {
      testConnection();
    }
  }, [visible]);

  const testConnection = async () => {
    setConnectionStatus('unknown');
    const isConnected = await testApiConnection();
    setConnectionStatus(isConnected ? 'success' : 'error');
  };

  const testCustomUrl = async () => {
    if (!customUrl.trim()) {
      Alert.alert('Lỗi', 'Nhập URL để test');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${customUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        Alert.alert('Thành công', `Kết nối OK: ${customUrl}`);
      } else {
        Alert.alert('Lỗi', `HTTP ${response.status}: ${customUrl}`);
      }
    } catch (error) {
      Alert.alert('Lỗi', `Không thể kết nối: ${customUrl}\n${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const quickTestUrls = [
    'http://localhost:8001',
    'http://127.0.0.1:8001',
    'http://192.168.1.100:8001', // Replace with your IP
    'http://10.0.2.2:8001',
  ];

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 API Debug (DEV MODE)</Text>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Current Config:</Text>
        <Text style={styles.value}>Platform: {Platform.OS}</Text>
        <Text style={styles.value}>API_URL: {API_URL}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Connection: </Text>
          <Text style={[
            styles.status,
            connectionStatus === 'success' && styles.statusSuccess,
            connectionStatus === 'error' && styles.statusError,
          ]}>
            {connectionStatus === 'success' ? '✅ OK' :
             connectionStatus === 'error' ? '❌ FAIL' : '⏳ TESTING'}
          </Text>
        </View>
      </View>

      <View style={styles.quickTestCard}>
        <Text style={styles.label}>Quick Tests:</Text>
        {quickTestUrls.map((url) => (
          <TouchableOpacity
            key={url}
            style={styles.testButton}
            onPress={async () => {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`${url}/health`, {
                  signal: controller.signal
                });

                clearTimeout(timeoutId);
                Alert.alert('Test Result', `${url}: ${response.ok ? 'OK' : 'FAIL'}`);
              } catch (error) {
                Alert.alert('Test Result', `${url}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }}
          >
            <Text style={styles.testButtonText}>Test {url}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customTestCard}>
        <Text style={styles.label}>Custom URL Test:</Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.xxx:8001"
          value={customUrl}
          onChangeText={setCustomUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.customTestButton} onPress={testCustomUrl}>
          <Text style={styles.customTestButtonText}>Test Custom URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
        <Text style={styles.instruction}>
          1. Test các URL ở trên để tìm URL hoạt động
        </Text>
        <Text style={styles.instruction}>
          2. Nếu localhost không work, dùng IP của máy (192.168.x.x)
        </Text>
        <Text style={styles.instruction}>
          3. Copy URL hoạt động vào config/api.ts
        </Text>
        <Text style={styles.instruction}>
          4. Restart Expo: expo r -c
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusSuccess: {
    color: '#34C759',
  },
  statusError: {
    color: '#FF3B30',
  },
  quickTestCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  customTestCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  customTestButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  customTestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionsCard: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 5,
    lineHeight: 20,
  },
});
