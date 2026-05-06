import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Lock, LogIn, User, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.161.68.44:5000';

// InputBox Component
const InputBox = ({ icon, placeholder, secure, keyboardType, onChange }: any) => (
  <View style={styles.inputContainer}>
    {icon}
    <TextInput 
      style={styles.input} 
      placeholder={placeholder} 
      placeholderTextColor="#64748b"
      secureTextEntry={secure}
      keyboardType={keyboardType}
      onChangeText={onChange}
      autoCapitalize="none"
    />
  </View>
);

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        const isGuest = await AsyncStorage.getItem('isGuest');
        
        if (isGuest === 'true') {
          // Guest mode active
          console.log('👤 Guest mode active');
          router.replace('/(tabs)');
        } else if (isLoggedIn === 'true' && userData) {
          // User is already logged in
          console.log('✅ User already logged in, redirecting...');
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      } finally {
        setCheckingAuth(false);
      }
    };
    
    checkLoginStatus();
  }, []);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Error", "Please enter phone number and password!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Store user data and login status
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        await AsyncStorage.setItem('userToken', data.user.id.toString());
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.removeItem('isGuest'); // Remove guest mode if active
        
        console.log('✅ Login successful, user data saved');
        
        // Navigate to main app
        router.replace('/(tabs)');
      } else {
        Alert.alert("Error", data.message || "Invalid credentials!");
      }
    } catch (error) {
      console.error("Login Error:", error);
      Alert.alert("Error", "Cannot connect to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    // Set guest mode flag
    await AsyncStorage.setItem('isGuest', 'true');
    await AsyncStorage.removeItem('isLoggedIn');
    await AsyncStorage.removeItem('userData');
    
    console.log('👤 Guest mode activated');
    router.replace('/(tabs)');
  };

  // Show loading screen while checking auth status
  if (checkingAuth) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E63939" />
          <Text style={styles.loadingText}>Checking session...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Shield size={40} color="#E63939" />
          </View>
          <Text style={styles.title}>SafeCity+</Text>
          <Text style={styles.subtitle}>Emergency Response System</Text>
        </View>

        <View style={styles.form}>
          <InputBox 
            icon={<Phone size={20} color="#64748b"/>} 
            placeholder="Phone Number" 
            keyboardType="phone-pad"
            onChange={setPhone} 
          />
          <InputBox 
            icon={<Lock size={20} color="#64748b"/>} 
            placeholder="Password" 
            secure 
            onChange={setPassword} 
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.btnText}>Login</Text>
                <LogIn size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Guest Mode Button */}
          <TouchableOpacity style={styles.guestBtn} onPress={handleGuestMode}>
            <User size={20} color="#E63939" />
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/register')} style={{marginTop: 30}}>
          <Text style={styles.linkText}>New here? <Text style={{color: '#E63939'}}>Create Account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(230, 57, 57, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 },
  form: { gap: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 15, borderRadius: 15, height: 60, borderWidth: 1, borderColor: '#334155' },
  input: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
  btn: { backgroundColor: '#E63939', height: 60, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  guestBtn: { backgroundColor: 'transparent', height: 50, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E63939', marginTop: 10 },
  guestBtnText: { color: '#E63939', fontSize: 16, fontWeight: '600' },
  linkText: { color: '#64748b', textAlign: 'center', fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 }
});