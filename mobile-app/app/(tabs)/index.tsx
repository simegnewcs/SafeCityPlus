import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Image, ActivityIndicator, RefreshControl,
  Animated, Easing, Dimensions, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://192.168.137.1:5000';

export default function HomeScreen() {
  const [userName, setUserName] = useState('Citizen');
  const [userRole, setUserRole] = useState('User');
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(3);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadUserData();
    fetchIncidents();
    fetchStats();
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 800, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, { 
        toValue: 0, 
        duration: 600, 
        useNativeDriver: true 
      })
    ]).start();

    // SOS Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { 
          toValue: 1.08, 
          duration: 1000, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
        Animated.timing(pulseAnim, { 
          toValue: 1, 
          duration: 1000, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Stats counter animation
    Animated.timing(statsAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.fullName?.split(' ')[0] || 'Citizen');
        setUserRole(user.role || 'User');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      setRecentIncidents(data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents/stats`);
      const data = await response.json();
      setStats({
        total: data.total || 0,
        active: data.byStatus?.find((s: any) => s.status === 'Pending')?.count || 0,
        resolved: data.byStatus?.find((s: any) => s.status === 'Resolved')?.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchIncidents(), fetchStats()]);
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      case 'medium':
        return 'time';
      default:
        return 'information-circle';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#10b981';
    }
  };

  const StatCard = ({ icon, value, label, color }: any) => (
    <Animated.View 
      style={[
        styles.statCard,
        {
          opacity: statsAnim,
          transform: [{
            scale: statsAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1]
            })
          }]
        }
      ]}
    >
      <LinearGradient colors={[`${color}20`, `${color}10`]} style={styles.statGradient}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </Animated.View>
  );

  const QuickAction = ({ icon, title, color, route }: any) => (
    <TouchableOpacity 
      style={styles.actionCard} 
      onPress={() => router.push(route)}
      activeOpacity={0.7}
    >
      <LinearGradient colors={[`${color}20`, `${color}05`]} style={styles.actionGradient}>
        <View style={[styles.actionIcon, { backgroundColor: color }]}>
          <Ionicons name={icon} size={22} color="#fff" />
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="rgb(44, 99, 226)" />
      <LinearGradient colors={['#1845b0', '#1e293b']} style={styles.gradient}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
          }
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName} <Text style={styles.roleBadge}>{userRole}</Text></Text>
            </View>
            <TouchableOpacity 
              style={styles.notifBtn} 
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={26} color="#fff" />
              {notifications > 0 && (
                <View style={styles.notificationDot}>
                  <Text style={styles.notificationCount}>{notifications}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Stats Section */}
          {/* <View style={styles.statsContainer}>
            <StatCard icon="stats-chart" value={stats.total} label="Total Reports" color="#3b82f6" />
            <StatCard icon="time" value={stats.active} label="Active" color="#f59e0b" />
            <StatCard icon="checkmark-circle" value={stats.resolved} label="Resolved" color="#10b981" />
          </View> */}

          {/* SOS Emergency Button */}
          <Animated.View style={[styles.sosContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity 
              style={styles.sosButton} 
              onPress={() => router.push('/camera')} 
              activeOpacity={0.9}
            >
              <LinearGradient 
                colors={['#E63939', '#b91c1c']} 
                style={styles.sosInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="alert-circle" size={60} color="#fff" />
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSub}>REPORT EMERGENCY</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <QuickAction icon="videocam" title="CCTV" color="#3b82f6" route="/cctv" />
              <QuickAction icon="map" title="Live Map" color="#8b5cf6" route="/map" />
              <QuickAction icon="bulb" title="Safety Tips" color="#10b981" route="/tips" />
              <QuickAction icon="document-text" title="Reports" color="#f59e0b" route="/reports" />
            </View>
          </View>

          {/* Recent Incidents */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Incidents</Text>
              <TouchableOpacity onPress={() => router.push('/reports')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color="#E63939" size="large" style={styles.loader} />
            ) : (
              recentIncidents.map((incident: any, index) => (
                <Animated.View
                  key={incident.id}
                  style={[
                    styles.incidentCard,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0]
                      })}]
                    }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.incidentContent}
                    onPress={() => router.push(`/report-details?id=${incident.id}`)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: `${API_URL}/uploads/${incident.media_name || incident.image_name}` }} 
                      style={styles.incidentImage}
                    />
                    <View style={styles.incidentInfo}>
                      <View style={styles.incidentHeader}>
                        <Text style={styles.incidentType}>{incident.type || 'Unknown'}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(incident.priority)}20` }]}>
                          <Ionicons name={getPriorityIcon(incident.priority)} size={10} color={getPriorityColor(incident.priority)} />
                          <Text style={[styles.priorityText, { color: getPriorityColor(incident.priority) }]}>
                            {incident.priority || 'Normal'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.incidentDesc} numberOfLines={2}>
                        {incident.description || 'No description provided'}
                      </Text>
                      <View style={styles.incidentFooter}>
                        <Ionicons name="time-outline" size={12} color="#64748b" />
                        <Text style={styles.incidentTime}>
                          {formatTime(incident.created_at)}
                        </Text>
                        <View style={[styles.statusDot, { backgroundColor: incident.status === 'Resolved' ? '#10b981' : '#f59e0b' }]} />
                        <Text style={styles.incidentStatus}>
                          {incident.status || 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#475569" />
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>

          {/* Safety Tips Section */}
          <View style={styles.safetySection}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.safetyCard}>
              <View style={styles.safetyHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#3b82f6" />
                <Text style={styles.safetyTitle}>Safety Tip</Text>
              </View>
              <Text style={styles.safetyText}>
                In case of emergency, stay calm, assess the situation, and use the SOS button to report immediately. Your safety is our priority.
              </Text>
              <TouchableOpacity style={styles.safetyButton}>
                <Text style={styles.safetyButtonText}>View All Tips</Text>
                <Ionicons name="arrow-forward" size={14} color="#3b82f6" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#20c34c' },
  gradient: { flex: 1 },
  scrollContent: { padding: 20 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  userName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  roleBadge: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },
  notifBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12, position: 'relative' },
  notificationDot: { position: 'absolute', top: 6, right: 6, backgroundColor: '#E63939', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationCount: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
  // Stats
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, gap: 12 },
  statCard: { flex: 1 },
  statGradient: { borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  
  // SOS Button
  sosContainer: { alignItems: 'center', marginBottom: 32 },
  sosButton: { width: width * 0.6, height: width * 0.6, borderRadius: width * 0.3, elevation: 15, shadowColor: '#E63939', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  sosInner: { flex: 1, borderRadius: width * 0.3, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  sosText: { color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 8 },
  sosSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 4 },
  
  // Sections
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  seeAllText: { color: '#E63939', fontSize: 13, fontWeight: '600' },
  
  // Quick Actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  actionCard: { width: (width - 52) / 2, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  actionGradient: { padding: 16, alignItems: 'center' },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  // Incident Cards
  incidentCard: { backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  incidentContent: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  incidentImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#0f172a' },
  incidentInfo: { flex: 1, marginLeft: 12 },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  incidentType: { color: '#fff', fontSize: 14, fontWeight: 'bold', flex: 1 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, gap: 4 },
  priorityText: { fontSize: 9, fontWeight: 'bold' },
  incidentDesc: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  incidentFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incidentTime: { color: '#64748b', fontSize: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  incidentStatus: { color: '#94a3b8', fontSize: 10 },
  
  // Safety Section
  safetySection: { marginTop: 8, marginBottom: 20 },
  safetyCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  safetyTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  safetyText: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  safetyButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  safetyButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: '500' },
  
  loader: { marginTop: 40 }
});