import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export const requestLocationPermission = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'SafeCity+ needs your location to report incidents accurately and send help to the right place.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Location permission error:', error);
    return false;
  }
};

export const getCurrentLocation = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    
    return location;
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

export const getLocationName = async (latitude: number, longitude: number) => {
  try {
    const address = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    
    if (address && address[0]) {
      const addr = address[0];
      return [
        addr.name,
        addr.street,
        addr.district,
        addr.city,
      ].filter(Boolean).join(', ');
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};