// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import AppLoader from '../components/AppLoader';

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
    return <AppLoader />;
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