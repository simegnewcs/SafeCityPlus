import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Phone, Lock, ArrowRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.137.1:5000';

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

export default function RegisterScreen() {
  const [formData, setFormData] = useState({ fullName: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!formData.fullName || !formData.phone || !formData.password) {
      Alert.alert("Error", "እባክዎ ሁሉንም ቦታዎች ይሙሉ");
      return;
    }

    setLoading(true);
    try {
      // 1. Register the user
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const textResponse = await response.text();
      console.log("Server Raw Response:", textResponse);
      const data = JSON.parse(textResponse);

      if (data.success) {
        // 2. Auto-login after successful registration
        console.log("✅ Registration successful, auto-logging in...");
        
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phone: formData.phone, 
            password: formData.password 
          }),
        });

        const loginData = await loginResponse.json();
        console.log("Login response:", loginData);

        if (loginData.success && loginData.user) {
          // 3. Store user data for persistent session
          await AsyncStorage.setItem('userData', JSON.stringify(loginData.user));
          await AsyncStorage.setItem('userToken', loginData.user.id.toString());
          await AsyncStorage.setItem('isLoggedIn', 'true');
          
          console.log("✅ User data saved, redirecting to main app");
          
          // 4. Navigate to main app
          router.replace('/(tabs)');
        } else {
          // If auto-login fails, redirect to login screen
          Alert.alert(
            "ስኬት", 
            "አካውንት ተፈጥሯል! እባክዎ ይግቡ",
            [{ text: "OK", onPress: () => router.replace('/login') }]
          );
        }
      } else {
        Alert.alert("ስህተት", data.message || "ምዝገባው አልተሳካም");
      }
    } catch (error) {
      console.error("Registration Error:", error);
      Alert.alert("ስህተት", "ከሰርቨር ጋር መገናኘት አልተቻለም። IP እና ሰርቨሩን ይፈትሹ።");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <User size={40} color="#3b82f6" />
          </View>
          <Text style={styles.title}>Join Safe City</Text>
          <Text style={styles.subtitle}>Secure your community with SafeCity+</Text>
        </View>

        <View style={styles.form}>
          <InputBox 
            icon={<User size={20} color="#64748b"/>} 
            placeholder="Full Name" 
            onChange={(val: string) => setFormData({...formData, fullName: val})} 
          />
          <InputBox 
            icon={<Phone size={20} color="#64748b"/>} 
            placeholder="Phone Number" 
            keyboardType="phone-pad" 
            onChange={(val: string) => setFormData({...formData, phone: val})} 
          />
          <InputBox 
            icon={<Lock size={20} color="#64748b"/>} 
            placeholder="Password" 
            secure 
            onChange={(val: string) => setFormData({...formData, password: val})} 
          />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.btnText}>Create Account</Text>
                <ArrowRight size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/login')} style={{marginTop: 30}}>
          <Text style={styles.linkText}>Already have an account? <Text style={{color: '#3b82f6'}}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  form: { gap: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 15, borderRadius: 15, height: 60, borderWidth: 1, borderColor: '#334155' },
  input: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
  btn: { backgroundColor: '#3b82f6', height: 60, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#64748b', textAlign: 'center', fontSize: 14 }
});