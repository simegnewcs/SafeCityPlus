import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { router } from 'expo-router';

export const logout = async () => {
  try {
    // Clear all stored user data
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('isLoggedIn');
    
    console.log('✅ User logged out successfully');
    
    // Navigate to login screen
    router.replace('/login');
    
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    Alert.alert('Error', 'Failed to logout. Please try again.');
    return false;
  }
};

// Get current logged in user
export const getCurrentUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Check if user is logged in
export const isLoggedIn = async () => {
  try {
    const loggedIn = await AsyncStorage.getItem('isLoggedIn');
    return loggedIn === 'true';
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
};