import { Platform } from 'react-native';

/**
 * API Configuration with Network Detection
 * Automatically detects platform and network conditions
 */

// Get local IP address for development
const getLocalIp = (): string => {
  // For development, try to get local network IP
  // This is a fallback - in production, use hardcoded values
  try {
    // In a real app, you might use a library to detect local IP
    // For now, we'll use common development IPs
    return '192.168.1.100'; // Replace with your actual IP
  } catch {
    return 'localhost';
  }
};

// Smart API URL detection
export const getApiUrl = (): string => {
  const platform = Platform.OS;

  console.log(`🔧 API Config: Detected platform: ${platform}`);

  // Android Emulator - special IP to access host machine
  if (platform === 'android') {
    const url = 'http://10.0.2.2:8001';
    console.log(`📱 Android: Using ${url}`);
    return url;
  }

  // iOS Simulator - use network IP (localhost often doesn't work)
  if (platform === 'ios') {
    // Try different IP addresses - change this to your machine's IP
    const possibleIPs = [
      '192.168.1.18',  // Current detected IP
      '192.168.1.100', // Common alternative
      '10.0.0.100',    // Another common range
    ];

    // Use the first working IP or default to detected one
    const networkIP = possibleIPs[0]; // Change index to try different IPs
    const networkUrl = `http://${networkIP}:8001`;

    console.log(`🍎 iOS: Using network IP ${networkUrl}`);
    console.log(`💡 iOS: If this IP doesn't work:`);
    console.log(`   1. Run: python detect_ip.py`);
    console.log(`   2. Or change networkIP above to your machine's IP`);
    console.log(`   3. Or use in-app debug tools`);

    return networkUrl;
  }

  // Web browser - localhost
  if (platform === 'web') {
    const url = 'http://localhost:8001';
    console.log(`🌐 Web: Using ${url}`);
    return url;
  }

  // Default fallback
  const url = 'http://localhost:8001';
  console.log(`❓ Unknown platform: Using ${url}`);
  return url;
};

// Export the API URL with logging
export const API_URL = (() => {
  const url = getApiUrl();
  console.log(`🚀 Final API_URL: ${url}`);
  return url;
})();

// Alternative configurations for manual override
export const API_CONFIGS = {
  localhost: 'http://localhost:8001',
  android: 'http://10.0.2.2:8001',
  ios_localhost: 'http://localhost:8001',
  ios_network: 'http://192.168.1.18:8001', // Detected IP for iOS
  production: 'https://your-production-api.com'
};

// Helper function to test connection
export const testApiConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('API Connection test failed:', error);
    return false;
  }
};

// Development helper - log current config
if (__DEV__) {
  console.log('🔧 API Configuration Debug:');
  console.log(`   Platform: ${Platform.OS}`);
  console.log(`   API_URL: ${API_URL}`);
  console.log(`   Available configs:`, API_CONFIGS);
}
