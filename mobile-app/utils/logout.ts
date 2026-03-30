import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { router } from 'expo-router';

export const logout = async () => {
  try {
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('isLoggedIn');
    await AsyncStorage.removeItem('isGuest');
    
    console.log('✅ User logged out successfully');
    router.replace('/login');
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    Alert.alert('Error', 'Failed to logout. Please try again.');
    return false;
  }
};

export const getCurrentUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    const isGuest = await AsyncStorage.getItem('isGuest');
    
    if (isGuest === 'true') {
      return { isGuest: true };
    }
    
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const isLoggedIn = async () => {
  try {
    const isGuest = await AsyncStorage.getItem('isGuest');
    const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
    
    if (isGuest === 'true') {
      return true;
    }
    
    return isLoggedIn === 'true';
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
};

// Default export for Expo Router
const logoutUtils = { logout, getCurrentUser, isLoggedIn };
export default logoutUtils;