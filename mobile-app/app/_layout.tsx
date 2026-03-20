// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { storage } from '../utils/storage';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('login');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const userToken = await storage.getItem('userToken');
      const userRole = await storage.getItem('userRole');
      const isGuest = await storage.getItem('isGuest');

      if (userToken || isGuest === 'true') {
        if (userRole === 'Admin' || userRole === 'SuperAdmin') {
          setInitialRoute('admin-dashboard');
        } else {
          setInitialRoute('(tabs)');
        }
      } else {
        setInitialRoute('login');
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setInitialRoute('login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A2540' }}>
        <ActivityIndicator size="large" color="#E63939" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin-dashboard" />
      <Stack.Screen name="emergency-report" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}