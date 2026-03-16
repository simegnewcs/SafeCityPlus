import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const [name, setName] = useState('Citizen');
  const [phone, setPhone] = useState('+251 9XX XXX XXX');
  const [role, setRole] = useState('Citizen');
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      const savedName = await AsyncStorage.getItem('fullName');
      const savedRole = await AsyncStorage.getItem('userRole');
      if (savedName) setName(savedName);
      if (savedRole) setRole(savedRole);
    };
    loadProfile();
  }, []);

  const handleEdit = () => {
    Alert.prompt(
      'Edit Profile',
      'Enter new full name',
      [
        { text: 'Cancel' },
        {
          text: 'Save',
          onPress: async (newName) => {
            if (newName) {
              setName(newName);
              await AsyncStorage.setItem('fullName', newName);
              Alert.alert('Success', 'Profile updated!');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    Alert.alert('Logged Out', 'Thank you for using SafeCity+');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://picsum.photos/id/64/200/200' }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.phone}>{phone}</Text>
        <Text style={styles.role}>{role}</Text>
      </View>

      <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
        <Text style={styles.editText}>✏️ Edit Profile</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Account Information</Text>
        <Text style={styles.infoRow}>📍 Addis Ababa, Ethiopia</Text>
        <Text style={styles.infoRow}>🛡️ Emergency Citizen Account</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 LOGOUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', padding: 20 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#E63939' },
  name: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginTop: 15 },
  phone: { fontSize: 18, color: '#ccc', marginTop: 5 },
  role: { fontSize: 16, color: '#ffcc00', fontWeight: '600', marginTop: 5 },
  editButton: { backgroundColor: '#1E3A5F', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  editText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoCard: { backgroundColor: '#1E3A5F', padding: 20, borderRadius: 12, marginBottom: 30 },
  infoTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  infoRow: { color: '#ccc', fontSize: 16, marginBottom: 10 },
  logoutButton: { backgroundColor: '#E63939', padding: 18, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});