import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Phone and password are required');
      return;
    }

    setLoading(true);
    // Mock API call (later connect to real backend)
    await new Promise(resolve => setTimeout(resolve, 800));

    const fakeToken = 'eyJmock-token-for-safecity-plus-' + Date.now();
    await AsyncStorage.setItem('userToken', fakeToken);
    await AsyncStorage.setItem('userRole', 'Citizen');

    Alert.alert('Success', 'Welcome to SafeCity+');
    router.replace('/(tabs)'); // Go to Home
    setLoading(false);
  };

  const handleGuest = async () => {
    await AsyncStorage.setItem('userToken', 'guest-token');
    await AsyncStorage.setItem('userRole', 'Guest');
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>SafeCity+</Text>
        <Text style={styles.subtitle}>Addis Ababa Emergency System</Text>

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+251 9XX XXX XXX"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'LOGIN'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGuest} style={styles.guestButton}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.registerText}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 30 },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', color: '#0A2540' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 30 },
  label: { fontWeight: '600', marginTop: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, marginTop: 8, fontSize: 16 },
  loginButton: { backgroundColor: '#E63939', padding: 18, borderRadius: 12, marginTop: 30, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  guestButton: { marginTop: 15, alignItems: 'center' },
  guestText: { color: '#0A2540', fontWeight: '600' },
  registerText: { textAlign: 'center', marginTop: 25, color: '#0066cc' },
});