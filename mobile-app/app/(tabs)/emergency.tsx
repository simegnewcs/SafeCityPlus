import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, Share, ActivityIndicator, RefreshControl,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AppLoader from '../../components/AppLoader';
import { API_BASE_URL } from '../../services/incidentService';

export default function EmergencyScreen() {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState([]);

  useEffect(() => {
    fetchEmergencyContacts();
    getLocation();
  }, []);

  const fetchEmergencyContacts = async () => {
    try {
      console.log('🔄 Fetching emergency contacts from:', `${API_BASE_URL}/emergency-contacts`);
      const response = await fetch(`${API_BASE_URL}/emergency-contacts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Emergency contacts fetched:', data.length, 'contacts');
      setEmergencyNumbers(data);
    } catch (error) {
      console.error('❌ Error fetching emergency contacts:', error);
      console.error('❌ Error details:', error.message);
      // Fallback to default contacts if API fails
      console.log('🔄 Using fallback emergency contacts');
      setEmergencyNumbers([
        { id: 1, name: 'Police', number: '911', alternative: '991', icon: 'shield-checkmark', color: '#3b82f6', description: 'Law enforcement and public safety' },
        { id: 2, name: 'Ambulance', number: '907', alternative: '991', icon: 'medkit', color: '#ef4444', description: 'Medical emergencies and ambulance services' },
        { id: 3, name: 'Fire Brigade', number: '912', alternative: '991', icon: 'flame', color: '#f59e0b', description: 'Fire incidents, rescue operations' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const handleCall = (number: string) => {
    Alert.alert(
      'Call Emergency Number',
      `Are you sure you want to call ${number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${number}`)
        }
      ]
    );
  };

  const handleShareLocation = async () => {
    if (!location) {
      Alert.alert('Location Unavailable', 'Unable to get your current location');
      return;
    }

    const message = `🚨 EMERGENCY! I need help at:\n📍 Lat: ${location.coords.latitude}\n📍 Lng: ${location.coords.longitude}\n\nSent from SafeCity+ App`;
    
    try {
      await Share.share({
        message: message,
        title: 'Share My Location - Emergency',
      });
    } catch (error) {
      console.error('Error sharing location:', error);
    }
  };

  const handleSMS = (number: string) => {
    if (!location) {
      Linking.openURL(`sms:${number}`);
      return;
    }

    const message = `🚨 EMERGENCY! I need help at: Lat ${location.coords.latitude}, Lng ${location.coords.longitude}. Please respond immediately!`;
    Linking.openURL(`sms:${number}?body=${encodeURIComponent(message)}`);
  };

  
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmergencyContacts();
    await getLocation();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <AppLoader message="Loading emergency contacts..." />
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Emergency</Text>
          <Text style={styles.subtitle}>Quick access to help</Text>
        </View>

        {/* SOS Button */}
        <TouchableOpacity 
          style={styles.sosButton}
          onPress={handleShareLocation}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#E63939', '#b91c1c']}
            style={styles.sosGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="alert-circle" size={40} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosSubtext}>Share My Location</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Emergency Numbers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call" size={22} color="#E63939" />
            <Text style={styles.sectionTitle}>Emergency Numbers</Text>
          </View>
          <View style={styles.numbersGrid}>
            {emergencyNumbers.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                style={styles.emergencyCard}
                onPress={() => handleCall(emergency.number)}
                onLongPress={() => emergency.alternative && handleCall(emergency.alternative)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[emergency.color + '20', emergency.color + '05']}
                  style={styles.emergencyGradient}
                >
                  <View style={[styles.emergencyIcon, { backgroundColor: emergency.color + '20' }]}>
                    <Ionicons name={emergency.icon as any} size={28} color={emergency.color} />
                  </View>
                  <Text style={styles.emergencyName}>{emergency.name}</Text>
                  <Text style={styles.emergencyNumber}>{emergency.number}</Text>
                  {emergency.alternative && (
                    <Text style={styles.emergencyAlt}>Alt: {emergency.alternative}</Text>
                  )}
                  <Text style={styles.emergencyDesc}>{emergency.description}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
        {/* Safety Tips */}
        <View style={styles.safetySection}>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <Ionicons name="bulb" size={24} color="#f59e0b" />
              <Text style={styles.safetyTitle}>Emergency Tips</Text>
            </View>
            <Text style={styles.safetyText}>
              • Stay calm and assess the situation
              • Call emergency services immediately
              • Share your exact location
              • Follow instructions from responders
              • Keep emergency contacts handy
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  
  sosButton: { marginHorizontal: 20, marginBottom: 24, borderRadius: 30, overflow: 'hidden' },
  sosGradient: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sosText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  sosSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  
  numbersGrid: { gap: 12 },
  emergencyCard: { borderRadius: 16, overflow: 'hidden' },
  emergencyGradient: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  emergencyIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  emergencyName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emergencyNumber: { color: '#E63939', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  emergencyAlt: { color: '#64748b', fontSize: 10, marginTop: 2 },
  emergencyDesc: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  
    
  safetySection: { marginHorizontal: 20, marginBottom: 20 },
  safetyCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  safetyTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  safetyText: { color: '#94a3b8', fontSize: 12, lineHeight: 20 },
});