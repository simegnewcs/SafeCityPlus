import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, ScrollView, Modal 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Phone, Mail, LogOut, Shield, Calendar, Award, FileText, CheckCircle, Clock, UserX } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import AppLoader from '../../components/AppLoader';

// Logout function
const logout = async (router: any) => {
  try {
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('isLoggedIn');
    await AsyncStorage.removeItem('isGuest');
    
    console.log('✅ Logged out successfully');
    router.replace('/login');
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    Alert.alert('Error', 'Failed to logout. Please try again.');
    return false;
  }
};

const exitGuestMode = async (router: any) => {
  try {
    await AsyncStorage.removeItem('isGuest');
    console.log('👤 Exited guest mode');
    router.replace('/login');
    return true;
  } catch (error) {
    console.error('Exit guest mode error:', error);
    return false;
  }
};

const getCurrentUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

const isGuestMode = async () => {
  try {
    const guest = await AsyncStorage.getItem('isGuest');
    return guest === 'true';
  } catch (error) {
    return false;
  }
};

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [stats, setStats] = useState({
    totalReports: 0,
    resolvedReports: 0,
    activeReports: 0
  });
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const userData = await getCurrentUser();
    const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');

    if (isLoggedIn === 'true' && userData) {
      // Properly logged in — clear any stale guest flag
      await AsyncStorage.removeItem('isGuest');
      setIsGuest(false);
      setUser(userData);
      loadUserStats(userData.id);
    } else {
      const guest = await isGuestMode();
      setIsGuest(guest);
    }
    setLoading(false);
  };

  const loadUserStats = async (userId: number) => {
    try {
      const response = await fetch(`http://10.161.68.44:5000/api/incidents/user/${userId}`);
      if (response.ok) {
        const incidents = await response.json();
        const total = incidents.length;
        const resolved = incidents.filter((i: any) => i.status === 'Resolved' || i.status === 'resolved').length;
        const active = incidents.filter((i: any) => i.status === 'Pending' || i.status === 'pending').length;
        
        setStats({
          totalReports: total,
          resolvedReports: resolved,
          activeReports: active
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = () => setShowLogoutModal(true);

  const handleExitGuestMode = () => setShowGuestModal(true);

  if (loading) {
    return (
      <AppLoader message="Loading profile..." />
    );
  }

  const GuestModal = () => (
    <Modal transparent animationType="fade" visible={showGuestModal} onRequestClose={() => setShowGuestModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <UserX size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
          <Text style={styles.modalTitle}>Exit Guest Mode</Text>
          <Text style={styles.modalMessage}>Create an account or login to save your reports and access full features.</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowGuestModal(false)}>
              <Text style={styles.modalCancelText}>Stay Guest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#f59e0b' }]} onPress={async () => { setShowGuestModal(false); await exitGuestMode(router); }}>
              <Text style={styles.modalConfirmText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const LogoutModal = () => (
    <Modal transparent animationType="fade" visible={showLogoutModal} onRequestClose={() => setShowLogoutModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <LogOut size={32} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={styles.modalTitle}>Logout</Text>
          <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={async () => { setShowLogoutModal(false); await logout(router); }}>
              <Text style={styles.modalConfirmText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Guest Mode View
  if (isGuest) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={[styles.avatar, { borderColor: '#f59e0b' }]}>
              <UserX size={50} color="#f59e0b" />
            </View>
            <Text style={styles.name}>Guest User</Text>
            <View style={[styles.roleBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Shield size={14} color="#f59e0b" />
              <Text style={[styles.roleText, { color: '#f59e0b' }]}>Guest Mode</Text>
            </View>
            <Text style={styles.guestDescription}>
              You are browsing as a guest. Create an account to save your reports and access full features.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Guest Mode Limitations</Text>
            <View style={styles.limitationItem}>
              <Text style={styles.limitationBullet}>•</Text>
              <Text style={styles.limitationText}>Reports are not saved to your profile</Text>
            </View>
            <View style={styles.limitationItem}>
              <Text style={styles.limitationBullet}>•</Text>
              <Text style={styles.limitationText}>No access to report history</Text>
            </View>
            <View style={styles.limitationItem}>
              <Text style={styles.limitationBullet}>•</Text>
              <Text style={styles.limitationText}>Cannot receive updates on reports</Text>
            </View>
            <View style={styles.limitationItem}>
              <Text style={styles.limitationBullet}>•</Text>
              <Text style={styles.limitationText}>Limited features available</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.upgradeButton} onPress={handleExitGuestMode}>
            <User size={20} color="#fff" />
            <Text style={styles.upgradeButtonText}>Create Account or Login</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleExitGuestMode}>
            <LogOut size={20} color="#fff" />
            <Text style={styles.logoutText}>Exit Guest Mode</Text>
          </TouchableOpacity>

          <View style={styles.footer} />
        </ScrollView>
        <GuestModal />
      </LinearGradient>
    );
  }

  // Logged-in User View
  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <User size={50} color="#E63939" />
          </View>
          <Text style={styles.name}>{user?.fullName || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Shield size={14} color="#E63939" />
            <Text style={styles.roleText}>{user?.role || 'Citizen'}</Text>
          </View>
          <View style={styles.phoneContainer}>
            <Mail size={14} color="#64748b" />
            <Text style={styles.phone}>{user?.email || 'No email set'}</Text>
          </View>
          <View style={[styles.phoneContainer, { marginTop: 4 }]}>
            <Phone size={14} color="#64748b" />
            <Text style={styles.phone}>{user?.phone || 'No phone number'}</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <FileText size={24} color="#E63939" />
            <Text style={styles.statNumber}>{stats.totalReports}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={24} color="#10b981" />
            <Text style={[styles.statNumber, { color: '#10b981' }]}>{stats.resolvedReports}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={24} color="#f59e0b" />
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{stats.activeReports}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoRow}>
            <User size={20} color="#64748b" />
            <Text style={styles.infoText}>Full Name: {user?.fullName || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Mail size={20} color="#64748b" />
            <Text style={styles.infoText}>Email: {user?.email || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Phone size={20} color="#64748b" />
            <Text style={styles.infoText}>Phone: {user?.phone || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Award size={20} color="#64748b" />
            <Text style={styles.infoText}>Role: {user?.role || 'Citizen'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Calendar size={20} color="#64748b" />
            <Text style={styles.infoText}>Member since: {new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.appInfoCard}>
          <Text style={styles.appName}>SafeCity+</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDescription}>Making communities safer with AI-powered emergency response</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
      <LogoutModal />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  
  header: { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(230, 57, 57, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#E63939' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(230, 57, 57, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, gap: 6, marginBottom: 8 },
  roleText: { color: '#E63939', fontSize: 12, fontWeight: '600' },
  phoneContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  phone: { color: '#64748b', fontSize: 14 },
  guestDescription: { color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingHorizontal: 30, marginTop: 10 },
  
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginTop: 20, marginBottom: 20 },
  statCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, alignItems: 'center', minWidth: 100, borderWidth: 1, borderColor: '#334155' },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#E63939', marginBottom: 5, marginTop: 8 },
  statLabel: { fontSize: 12, color: '#64748b' },
  
  infoCard: { backgroundColor: '#1e293b', borderRadius: 15, marginHorizontal: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 12 },
  infoText: { color: '#fff', fontSize: 14, flex: 1 },
  divider: { height: 1, backgroundColor: '#334155' },
  
  limitationItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  limitationBullet: { color: '#f59e0b', fontSize: 18, fontWeight: 'bold' },
  limitationText: { color: '#94a3b8', fontSize: 14, flex: 1 },
  
  appInfoCard: { backgroundColor: '#1e293b', borderRadius: 15, marginHorizontal: 20, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  appName: { fontSize: 18, fontWeight: 'bold', color: '#E63939', marginBottom: 5 },
  appVersion: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  appDescription: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', marginHorizontal: 20, padding: 15, borderRadius: 12, gap: 10, marginBottom: 20 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  upgradeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E63939', marginHorizontal: 20, padding: 15, borderRadius: 12, gap: 10, marginBottom: 15 },
  upgradeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer: { height: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  modalBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  modalMessage: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  modalCancelText: { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
  modalConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});