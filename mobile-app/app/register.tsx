import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    if (!fullName || !phone || !password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    const fakeToken = 'eyJmock-token-for-safecity-plus-' + Date.now();
    await AsyncStorage.setItem('userToken', fakeToken);
    await AsyncStorage.setItem('userRole', 'Citizen');
    await AsyncStorage.setItem('fullName', fullName);

    Alert.alert('Success', 'Account created! You are now logged in.');
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} placeholder="Abebe Kebede" value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} placeholder="+251 9XX XXX XXX" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} placeholder="Create password" secureTextEntry value={password} onChangeText={setPassword} />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.buttonText}>REGISTER</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Already have account? Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 30 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#0A2540', marginBottom: 20 },
  label: { fontWeight: '600', marginTop: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, marginTop: 8, fontSize: 16 },
  registerButton: { backgroundColor: '#E63939', padding: 18, borderRadius: 12, marginTop: 30, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backText: { textAlign: 'center', marginTop: 25, color: '#0066cc' },
});