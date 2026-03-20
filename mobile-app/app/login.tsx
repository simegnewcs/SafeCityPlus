import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Lock, LogIn } from 'lucide-react-native';

const API_URL = 'http://192.168.137.1:5000'; // ያንተ IP

// የጋራ ኢንፑት ኮምፖነንት
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
  const router = useRouter();

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Error", "እባክዎ ስልክ ቁጥር እና ፓስወርድ ያስገቡ!");
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
        // ስኬታማ ከሆነ ወደ ታቦቹ (Main Dashboard) ይመራል
        router.replace('/(tabs)');
      } else {
        Alert.alert("ስህተት", data.message || "የመግቢያ መረጃዎ ስህተት ነው!");
      }
    } catch (error) {
      console.error("Login Error:", error);
      Alert.alert("ስህተት", "ከሰርቨር ጋር መገናኘት አልተቻለም።");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <LogIn size={40} color="#3b82f6" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Safe City Plus Command Center</Text>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/register')} style={{marginTop: 30}}>
          <Text style={styles.linkText}>New here? <Text style={{color: '#3b82f6'}}>Create Account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 },
  form: { gap: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 15, borderRadius: 15, height: 60, borderWidth: 1, borderColor: '#334155' },
  input: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
  btn: { backgroundColor: '#3b82f6', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#64748b', textAlign: 'center', fontSize: 14 }
});