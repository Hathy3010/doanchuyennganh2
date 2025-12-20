import { Text, View, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = await AsyncStorage.getItem('access_token');
    const role = await AsyncStorage.getItem('user_role');

    if (token) {
      // User is logged in, redirect to appropriate dashboard
      if (role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/student');
    }
  }
  };

  return (
    <View style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.title}>Smart Attendance</Text>
        <Text style={styles.subtitle}>Hệ thống điểm danh thông minh</Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Đăng nhập"
            onPress={() => router.push('/login')}
          />
          <View style={styles.buttonSpacing} />
        <Button 
            title="Đăng ký"
            onPress={() => router.push('/register-user')}
        />
        </View>

        <Text style={styles.description}>
          Sử dụng nhận dạng khuôn mặt và định vị GPS để điểm danh chính xác và thuận tiện.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 30,
  },
  buttonSpacing: {
    height: 15,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});