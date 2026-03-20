import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, ShieldCheck, Bell, Settings, LogOut, ChevronRight, Phone } from 'lucide-react-native';

export default function ProfileScreen() {
  const [isVerified, setIsVerified] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* Header with Gradient */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: 'https://ui-avatars.com/api/?name=SafeCity++User&background=2563eb&color=fff&size=128' }} 
              style={styles.avatar} 
            />
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={16} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>Simegnew A.</Text>
          <Text style={styles.userRole}>Full-Stack Developer | CEO</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatItem label="Reports" value="12" />
          <StatItem label="Points" value="450" />
          <StatItem label="Rank" value="Gold" />
        </View>
      </LinearGradient>

      {/* Settings Sections */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Account Security</Text>
        <SettingItem 
          icon={<ShieldCheck size={20} color="#10b981" />} 
          title="2FA Authentication" 
          subtitle="Verified via SMS"
          right={<Text style={styles.statusText}>Active</Text>}
        />
        <SettingItem 
          icon={<Phone size={20} color="#3b82f6" />} 
          title="Emergency Contact" 
          subtitle="+251 9xx xxx xxx"
        />

        <Text style={styles.sectionTitle}>Preferences</Text>
        <SettingItem 
          icon={<Bell size={20} color="#f59e0b" />} 
          title="Push Notifications" 
          right={<Switch value={notifications} onValueChange={setNotifications} />}
        />
        <SettingItem 
          icon={<Settings size={20} color="#64748b" />} 
          title="App Settings" 
        />

        <TouchableOpacity style={styles.logoutBtn}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout from SafeCity+</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Safe City Plus v1.0.0 — BDU Graduation Project</Text>
      </View>
    </ScrollView>
  );
}

// ትናንሽ ኮምፖነንቶች
const StatItem = ({ label, value }: any) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const SettingItem = ({ icon, title, subtitle, right }: any) => (
  <TouchableOpacity style={styles.settingItem}>
    <View style={styles.settingIcon}>{icon}</View>
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {right ? right : <ChevronRight size={18} color="#cbd5e1" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 40, paddingTop: 60, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, alignItems: 'center' },
  profileInfo: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: 'rgba(255,255,255,0.1)' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10b981', padding: 6, borderRadius: 20, borderWidth: 3, borderColor: '#0f172a' },
  userName: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 15 },
  userRole: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25, padding: 20, width: '100%', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  content: { padding: 25 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 15, marginTop: 10 },
  settingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  settingTextContainer: { flex: 1, marginLeft: 15 },
  settingTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  settingSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#10b981' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, padding: 15 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  footerText: { textAlign: 'center', color: '#cbd5e1', fontSize: 10, marginTop: 30, marginBottom: 100 }
});