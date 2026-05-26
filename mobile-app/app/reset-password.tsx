import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react-native';
import AppLoader from '../components/AppLoader';

const API_URL = 'http://10.161.68.44:5000';

const getChecks = (pwd: string) => ([
  { label: 'At least 6 characters',         pass: pwd.length >= 6 },
  { label: 'One uppercase letter (A-Z)',     pass: /[A-Z]/.test(pwd) },
  { label: 'One number (0-9)',               pass: /[0-9]/.test(pwd) },
  { label: 'One special character (!@#...)', pass: /[^A-Za-z0-9]/.test(pwd) },
]);

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const checks = getChecks(newPassword);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('Invalid reset link');
      setValidatingToken(false);
      return;
    }

    try {
      // For now, we'll assume the token is valid if it exists
      // In a real implementation, you might want to validate the token first
      setTokenValid(true);
      setValidatingToken(false);
    } catch (error) {
      setError('Invalid or expired reset link');
      setValidatingToken(false);
    }
  };

  const validate = () => {
    let valid = true;
    setError('');

    if (!newPassword) {
      setError('New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: token as string, 
          newPassword 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset Password Error:', error);
      setError('Cannot connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return <AppLoader message="Validating reset link..." />;
  }

  if (!tokenValid) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.content}>
          <AlertCircle size={60} color="#ef4444" />
          <Text style={styles.errorTitle}>Invalid Reset Link</Text>
          <Text style={styles.errorMessage}>
            This password reset link is invalid or has expired.
          </Text>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.backBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Lock size={40} color="#E63939" />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your new password</Text>
        </View>

        {success ? (
          <View style={styles.successContainer}>
            <CheckCircle size={60} color="#10b981" />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successMessage}>{success}</Text>
          </View>
        ) : (
          <>
            {/* New Password Field */}
            <View style={styles.inputContainer}>
              <Lock size={20} color="#64748b" />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color="#64748b" />
                ) : (
                  <Eye size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            {newPassword.length > 0 && (
              <View style={styles.checkList}>
                {checks.map((check, i) => (
                  <View key={i} style={styles.checkRow}>
                    <View style={[styles.checkDot, { backgroundColor: check.pass ? '#10b981' : '#334155' }]}>
                      {check.pass && <Text style={styles.checkTick}>✓</Text>}
                    </View>
                    <Text style={[styles.checkLabel, { color: check.pass ? '#10b981' : '#64748b' }]}>
                      {check.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confirm Password Field */}
            <View style={styles.inputContainer}>
              <Lock size={20} color="#64748b" />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#64748b" />
                ) : (
                  <Eye size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity 
              style={styles.resetBtn} 
              onPress={handleResetPassword} 
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.resetBtnText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 15 },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 15, 
    borderRadius: 15, 
    height: 60, 
    borderWidth: 1, 
    borderColor: '#334155',
    marginBottom: 15
  },
  input: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
  checkList: { marginTop: 10, marginBottom: 20, gap: 6, backgroundColor: '#0f172a', borderRadius: 12, padding: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  checkTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkLabel: { fontSize: 13 },
  resetBtn: { backgroundColor: '#E63939', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  resetBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: 'transparent', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginTop: 10 },
  cancelBtnText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 14, marginTop: 10, textAlign: 'center' },
  errorTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  errorMessage: { color: '#64748b', fontSize: 16, marginTop: 10, textAlign: 'center', lineHeight: 24 },
  backBtn: { backgroundColor: '#E63939', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  successContainer: { alignItems: 'center', paddingVertical: 40 },
  successTitle: { color: '#10b981', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  successMessage: { color: '#64748b', fontSize: 16, marginTop: 10, textAlign: 'center', lineHeight: 24 }
});
