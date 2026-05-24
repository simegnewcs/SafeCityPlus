import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, LogIn, User, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.161.68.44:5000';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getChecks = (pwd: string) => ([
  { label: 'At least 8 characters',         pass: pwd.length >= 8 },
  { label: 'One uppercase letter (A-Z)',     pass: /[A-Z]/.test(pwd) },
  { label: 'One number (0-9)',               pass: /[0-9]/.test(pwd) },
  { label: 'One special character (!@#...)', pass: /[^A-Za-z0-9]/.test(pwd) },
]);

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  const checks = getChecks(password);

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
          // User is already logged in — clear any stale guest flag
          await AsyncStorage.removeItem('isGuest');
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

  const validate = () => {
    let valid = true;
    if (!email) { setEmailError('Email is required'); valid = false; }
    else if (!EMAIL_REGEX.test(email)) { setEmailError('Enter a valid email address'); valid = false; }
    else setEmailError('');

    if (!password) { setPasswordError('Password is required'); valid = false; }
    else if (password.length < 6) { setPasswordError('Password must be at least 6 characters'); valid = false; }
    else setPasswordError('');
    return valid;
  };

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        setPasswordError(data.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error("Login Error:", error);
      setEmailError('Cannot connect to server. Check your connection.');
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
          {/* Email Field */}
          <View>
            <View style={[styles.inputContainer, emailError && touched.email ? styles.inputError : {}]}>
              <Mail size={20} color={emailError && touched.email ? '#ef4444' : '#64748b'}/>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(v) => { setEmail(v); if (touched.email) setEmailError(EMAIL_REGEX.test(v) ? '' : 'Enter a valid email address'); }}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
              />
            </View>
            {emailError && touched.email && <Text style={styles.fieldError}>{emailError}</Text>}
          </View>

          {/* Password Field */}
          <View>
            <View style={[styles.inputContainer, passwordError && touched.password ? styles.inputError : {}]}>
              <Lock size={20} color={passwordError && touched.password ? '#ef4444' : '#64748b'}/>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#64748b"
                secureTextEntry
                autoCapitalize="none"
                onChangeText={(v) => { setPassword(v); if (touched.password) setPasswordError(v.length >= 6 ? '' : 'Password must be at least 6 characters'); }}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
              />
            </View>
            {touched.password && password.length > 0 && (
              <View style={styles.checkList}>
                {checks.map((c, i) => (
                  <View key={i} style={styles.checkRow}>
                    <View style={[styles.checkDot, { backgroundColor: c.pass ? '#10b981' : '#334155' }]}>
                      {c.pass && <Text style={styles.checkTick}>✓</Text>}
                    </View>
                    <Text style={[styles.checkLabel, { color: c.pass ? '#10b981' : '#64748b' }]}>{c.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {passwordError && touched.password && <Text style={styles.fieldError}>{passwordError}</Text>}
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.btnText}>Login</Text>
                <LogIn size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Create Account Button */}
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/register')}>
            <User size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create Account</Text>
          </TouchableOpacity>

          {/* Guest Mode Button */}
          <TouchableOpacity style={styles.guestBtn} onPress={handleGuestMode}>
            <User size={20} color="#E63939" />
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.linkText, {marginTop: 30}]}>Authorized personnel only</Text>
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
  inputError: { borderColor: '#ef4444' },
  input: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
  fieldError: { color: '#ef4444', fontSize: 12, marginTop: 5, marginLeft: 4 },
  checkList: { marginTop: 10, gap: 6, backgroundColor: '#0f172a', borderRadius: 12, padding: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  checkTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkLabel: { fontSize: 13 },
  btn: { backgroundColor: '#E63939', height: 60, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  createBtn: { backgroundColor: '#3b82f6', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  guestBtn: { backgroundColor: 'transparent', height: 50, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E63939', marginTop: 10 },
  guestBtnText: { color: '#E63939', fontSize: 16, fontWeight: '600' },
  linkText: { color: '#64748b', textAlign: 'center', fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 }
});