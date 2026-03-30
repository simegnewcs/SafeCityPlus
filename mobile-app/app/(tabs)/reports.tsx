import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, StyleSheet, 
  ActivityIndicator, RefreshControl, TouchableOpacity, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = 'http://192.168.137.1:5000';

export default function ReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    checkUserMode();
  }, []);

  const checkUserMode = async () => {
    try {
      const guest = await AsyncStorage.getItem('isGuest');
      const userData = await AsyncStorage.getItem('userData');
      
      console.log('Reports - Guest:', guest, 'UserData:', userData ? 'exists' : 'none');
      
      if (guest === 'true') {
        setIsGuest(true);
        fetchAllReports();
      } else if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        fetchUserReports(parsedUser.id);
      } else {
        fetchAllReports();
      }
    } catch (error) {
      console.error('Error checking user mode:', error);
      fetchAllReports();
    }
  };

  const fetchUserReports = async (userId: number) => {
    try {
      setLoading(true);
      console.log('📋 Fetching reports for user ID:', userId);
      
      const userData = await AsyncStorage.getItem('userData');
      const user = JSON.parse(userData!);
      
      const response = await fetch(`${API_URL}/api/incidents/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      
      const data = await response.json();
      console.log('📋 User reports received:', data.length);
      setReports(data);
    } catch (error) {
      console.error('Error fetching user reports:', error);
      Alert.alert('Error', 'Failed to load your reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReports = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      console.log('📋 All reports received:', data.length);
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isGuest || !user) {
      await fetchAllReports();
    } else {
      await fetchUserReports(user.id);
    }
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'in progress':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return '#d1fae5';
      case 'pending':
        return '#fed7aa';
      case 'in progress':
        return '#dbeafe';
      default:
        return '#f1f5f9';
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
      case 'normal':
        return '#10b981';
      default:
        return '#64748b';
    }
  };

  const getPriorityBgColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return '#fee2e2';
      case 'high':
        return '#fee2e2';
      case 'medium':
        return '#fed7aa';
      case 'normal':
        return '#d1fae5';
      default:
        return '#f1f5f9';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }: any) => {
    const isVideo = item.media_type === 'video';
    const mediaUrl = `${API_URL}/uploads/${item.media_name}`;
    const videoDuration = item.video_duration || 0;
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={() => router.push(`/report-details?id=${item.id}`)}
      >
        {/* Media Preview */}
        <View style={styles.mediaContainer}>
          {item.media_name ? (
            <View>
              <Image 
                source={{ uri: mediaUrl }} 
                style={styles.image}
              />
              {isVideo && (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={12} color="white" />
                  {videoDuration > 0 && (
                    <Text style={styles.durationText}>{formatDuration(videoDuration)}</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              {isVideo ? (
                <Ionicons name="videocam" size={30} color="#64748b" />
              ) : (
                <Ionicons name="camera" size={30} color="#64748b" />
              )}
            </View>
          )}
        </View>
        
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.type} numberOfLines={1}>{item.type || 'Unknown Incident'}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityBgColor(item.priority) }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>
                {item.priority || 'Normal'}
              </Text>
            </View>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {item.description || "No description provided."}
          </Text>

          <View style={styles.footer}>
            <View style={styles.footerItem}>
              <Ionicons name="calendar-outline" size={12} color="#64748b" />
              <Text style={styles.footerText}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Ionicons name="location-outline" size={12} color="#64748b" />
              <Text style={styles.footerText}>
                {item.latitude && item.longitude 
                  ? `${parseFloat(item.latitude).toFixed(4)}, ${parseFloat(item.longitude).toFixed(4)}` 
                  : 'Unknown'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status || 'Pending'}
              </Text>
            </View>
          </View>

          {/* Media Type Indicator */}
          <View style={styles.mediaTypeBadge}>
            {isVideo ? (
              <>
                <Ionicons name="videocam" size={10} color="#E63939" />
                <Text style={styles.mediaTypeText}>Video Evidence</Text>
              </>
            ) : (
              <>
                <Ionicons name="camera" size={10} color="#3b82f6" />
                <Text style={[styles.mediaTypeText, { color: '#3b82f6' }]}>Photo Evidence</Text>
              </>
            )}
          </View>

          {isGuest && item.reporter_name && (
            <View style={styles.reporterInfo}>
              <Ionicons name="person-outline" size={10} color="#94a3b8" />
              <Text style={styles.reporterText}>Reported by: {item.reporter_name}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color="#cbd5e1" style={{ marginRight: 10 }} />
      </TouchableOpacity>
    );
  };

  const GuestModeHeader = () => (
    <View style={styles.guestHeader}>
      <Ionicons name="alert-triangle-outline" size={16} color="#f59e0b" />
      <Text style={styles.guestHeaderText}>
        You're viewing all incidents. Create an account to track your own reports.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.topHeader}>
          <Text style={styles.title}>Incident Reports</Text>
          <Text style={styles.subtitle}>Loading...</Text>
        </LinearGradient>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E63939" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.topHeader}>
        <Text style={styles.title}>
          {isGuest ? 'All Incidents' : 'My Reports'}
        </Text>
        <Text style={styles.subtitle}>
          {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} Found
        </Text>
      </LinearGradient>

      {isGuest && reports.length > 0 && <GuestModeHeader />}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, reports.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="shield-outline" size={60} color="#334155" />
            <Text style={styles.emptyText}>
              {isGuest ? 'No incidents reported yet.' : 'You haven\'t reported any incidents yet.'}
            </Text>
            {!isGuest && (
              <TouchableOpacity 
                style={styles.reportButton}
                onPress={() => router.push('/emergency-report')}
              >
                <Text style={styles.reportButtonText}>Report an Incident</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 5, fontWeight: 'bold' },
  list: { padding: 15, paddingBottom: 100 },
  emptyList: { flexGrow: 1 },
  card: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    marginBottom: 15, 
    alignItems: 'center',
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }
  },
  mediaContainer: { position: 'relative' },
  image: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#f1f5f9' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  durationText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  content: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  type: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize', flex: 1, marginRight: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  priorityText: { fontSize: 10, fontWeight: 'bold' },
  description: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '600' },
  mediaTypeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  mediaTypeText: { fontSize: 8, color: '#E63939', fontWeight: '500' },
  reporterInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  reporterText: { fontSize: 9, color: '#94a3b8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#64748b', marginTop: 12, fontSize: 14, textAlign: 'center' },
  reportButton: { marginTop: 20, backgroundColor: '#E63939', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  reportButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  guestHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fef3c7', 
    marginHorizontal: 15, 
    marginTop: 10, 
    marginBottom: 5,
    padding: 10, 
    borderRadius: 12,
    gap: 8
  },
  guestHeaderText: { color: '#92400e', fontSize: 11, flex: 1 }
});