import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Image, ActivityIndicator, RefreshControl,
  Animated, Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; // 👈 የታብ ችግርን የሚፈታ
import { ShieldAlert, Video, Map as MapIcon, Lightbulb, Bell, User } from 'lucide-react-native';

const API_URL = 'http://192.168.137.1:5000'; 

export default function HomeScreen() {
  const [userName, setUserName] = useState('Developer');
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 👈 ለስልኩ ሜኑ ክፍተት ሰጪ

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchIncidents();
    
    // Fade in effect
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 800, 
      useNativeDriver: true 
    }).start();

    // SOS Pulse effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      setRecentIncidents(data.slice(0, 4));
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIncidents();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={['#1faba9', '#225ab5']} style={styles.gradient}>
        <ScrollView 
          contentContainerStyle={[
            styles.scroll, 
            { paddingBottom: insets.bottom + 100 } // 👈 የታችኛው ታብ እንዳይሸፈን ክፍተት ይጨምራል
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName} 👋</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn}>
              <Bell color="#fff" size={26} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          {/* SOS Section with Pulse Animation */}
          <View style={styles.sosContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
               <TouchableOpacity 
                style={styles.sosButton} 
                onPress={() => router.push('/camera')} 
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.sosInner}>
                  <ShieldAlert size={50} color="#fff" />
                  <Text style={styles.sosText}>SOS</Text>
                  <Text style={styles.sosSub}>REPORT EMERGENCY</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <ActionBtn icon={<Video color="#fff" size={20}/>} title="CCTV" color="#3b82f6" onPress={() => router.push('/cctv')} />
            <ActionBtn icon={<MapIcon color="#fff" size={20}/>} title="Map" color="#8b5cf6" onPress={() => router.push('/map')} />
            <ActionBtn icon={<Lightbulb color="#fff" size={20}/>} title="Tips" color="#10b981" onPress={() => router.push('/tips')} />
            <ActionBtn icon={<ShieldAlert color="#fff" size={20}/>} title="Logs" color="#f59e0b" onPress={() => router.push('/reports')} />
          </View>

          {/* Recent Incidents Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Incidents</Text>
            <TouchableOpacity onPress={() => router.push('/reports')}>
              <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: 'bold' }}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 20 }} />
          ) : (
            recentIncidents.map((incident) => (
              <TouchableOpacity key={incident.id} style={styles.incidentCard}>
                <Image 
                  source={{ uri: `${API_URL}/uploads/${incident.image_name}` }} 
                  style={styles.incidentImage} 
                />
                <View style={styles.info}>
                  <Text style={styles.type}>{incident.type || 'Unknown'}</Text>
                  <Text style={styles.desc} numberOfLines={1}>{incident.description || 'No description provided'}</Text>
                  <View style={[styles.badge, { backgroundColor: incident.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <Text style={[styles.badgeText, { color: incident.priority === 'High' ? '#ef4444' : '#3b82f6' }]}>
                      {incident.priority}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const ActionBtn = ({ icon, title, color, onPress }: any) => (
  <TouchableOpacity style={[styles.actionCard, { borderLeftColor: color, borderLeftWidth: 4 }]} onPress={onPress}>
    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>{icon}</View>
    <Text style={styles.actionTitle}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#45c966' },
  gradient: { flex: 1 },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, marginTop: 10 },
  greeting: { color: '#13db42', fontSize: 44, fontWeight: '500' },
  userName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  notifBtn: { backgroundColor: 'rgb(109, 216, 32)', p: 10, borderRadius: 12, padding: 10, borderWeight: 1, borderColor: '#334155' },
  notificationDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#1e293b' },
  sosContainer: { alignItems: 'center', marginBottom: 40 },
  sosButton: { width: 280, height: 280, borderRadius: 90, elevation: 25, shadowColor: '#ef4444', shadowOpacity: 0.9, shadowRadius: 80, shadowOffset: { width: 0, height: 0 } },
  sosInner: { flex: 1, borderRadius: 90, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'rgba(200, 32, 32, 0.2)' },
  sosText: { color: '#fff', fontSize: 78, fontWeight: '900' },
  sosSub: { color: '#4240a8', fontSize: 19, fontWeight: 'bold', letterSpacing: 1.5, marginTop: -5 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 15, marginBottom: 25 },
  actionCard: { width: '48%', backgroundColor: '#1e293b', padding: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
  iconCircle: { p: 8, borderRadius: 10, padding: 6 },
  actionTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  incidentCard: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 20, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },

  incidentImage: { width: 65, height: 65, borderRadius: 15 },
  
  info: { marginLeft: 15, flex: 1 },
  type: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  desc: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }
});