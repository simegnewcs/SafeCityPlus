import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, Share, ActivityIndicator, RefreshControl,
  TextInput, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import AppLoader from '../../components/AppLoader';

// Emergency numbers
const EMERGENCY_NUMBERS = [
  { 
    id: 1, 
    name: 'Police', 
    number: '911', 
    alternative: '991', 
    icon: 'shield-checkmark',
    color: '#3b82f6',
    description: 'Report crimes, suspicious activities'
  },
  { 
    id: 2, 
    name: 'Ambulance', 
    number: '907', 
    alternative: '911', 
    icon: 'medkit',
    color: '#ef4444',
    description: 'Medical emergencies, injuries'
  },
  { 
    id: 3, 
    name: 'Fire Department', 
    number: '939', 
    alternative: '911', 
    icon: 'flame',
    color: '#f97316',
    description: 'Fire incidents, rescue operations'
  },
  { 
    id: 4, 
    name: 'Road Traffic', 
    number: '945', 
    alternative: '991', 
    icon: 'car',
    color: '#10b981',
    description: 'Car accidents, traffic issues'
  },
  { 
    id: 5, 
    name: 'Electricity Emergency', 
    number: '980', 
    alternative: '991', 
    icon: 'flash',
    color: '#f59e0b',
    description: 'Power outages, electrical hazards'
  },
];

interface CustomContact {
  id: string;
  name: string;
  number: string;
  relationship: string;
}

export default function EmergencyScreen() {
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', number: '', relationship: '' });

  useEffect(() => {
    loadCustomContacts();
    getLocation();
  }, []);

  const loadCustomContacts = async () => {
    try {
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (savedContacts) {
        setCustomContacts(JSON.parse(savedContacts));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCustomContacts = async (contacts: CustomContact[]) => {
    try {
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(contacts));
      setCustomContacts(contacts);
    } catch (error) {
      console.error('Error saving contacts:', error);
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

  const addCustomContact = () => {
    if (!newContact.name || !newContact.number) {
      Alert.alert('Error', 'Please fill in name and number');
      return;
    }

    const newId = Date.now().toString();
    const updatedContacts = [...customContacts, { ...newContact, id: newId }];
    saveCustomContacts(updatedContacts);
    setNewContact({ name: '', number: '', relationship: '' });
    setShowAddContact(false);
    Alert.alert('Success', 'Emergency contact added');
  };

  const removeCustomContact = (id: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            const updatedContacts = customContacts.filter(c => c.id !== id);
            saveCustomContacts(updatedContacts);
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
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
            {EMERGENCY_NUMBERS.map((emergency) => (
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

        {/* Custom Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={22} color="#E63939" />
            <Text style={styles.sectionTitle}>My Emergency Contacts</Text>
            <TouchableOpacity onPress={() => setShowAddContact(!showAddContact)}>
              <Ionicons name="add-circle" size={24} color="#E63939" />
            </TouchableOpacity>
          </View>

          {showAddContact && (
            <View style={styles.addContactForm}>
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                placeholderTextColor="#64748b"
                value={newContact.name}
                onChangeText={(text) => setNewContact({ ...newContact, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={newContact.number}
                onChangeText={(text) => setNewContact({ ...newContact, number: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Relationship (e.g., Family, Friend)"
                placeholderTextColor="#64748b"
                value={newContact.relationship}
                onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
              />
              <View style={styles.addContactButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddContact(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={addCustomContact}>
                  <Text style={styles.saveButtonText}>Add Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {customContacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Ionicons name="people-outline" size={40} color="#334155" />
              <Text style={styles.emptyText}>No emergency contacts added</Text>
              <Text style={styles.emptySubtext}>Add family or friends to contact in emergencies</Text>
            </View>
          ) : (
            customContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactInfo}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactInitial}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                    <Text style={styles.contactNumber}>{contact.number}</Text>
                  </View>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCall(contact.number)}
                  >
                    <Ionicons name="call" size={20} color="#10b981" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleSMS(contact.number)}
                  >
                    <Ionicons name="chatbubble" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => removeCustomContact(contact.id)}
                  >
                    <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
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
  
  addContactForm: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
  input: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  addContactButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, backgroundColor: '#334155', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 14 },
  saveButton: { flex: 1, backgroundColor: '#E63939', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  
  emptyContacts: { backgroundColor: '#1e293b', borderRadius: 16, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: '#64748b', fontSize: 14 },
  emptySubtext: { color: '#475569', fontSize: 12, textAlign: 'center' },
  
  contactCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  contactInfo: { flexDirection: 'row', gap: 12, flex: 1 },
  contactAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E63939', justifyContent: 'center', alignItems: 'center' },
  contactInitial: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  contactDetails: { flex: 1 },
  contactName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  contactRelationship: { color: '#64748b', fontSize: 11, marginTop: 2 },
  contactNumber: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 12 },
  actionButton: { padding: 8, backgroundColor: '#0f172a', borderRadius: 10 },
  
  safetySection: { marginHorizontal: 20, marginBottom: 20 },
  safetyCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  safetyTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  safetyText: { color: '#94a3b8', fontSize: 12, lineHeight: 20 },
});