import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Dimensions,
  Modal, Animated, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://192.168.137.1:5000';

interface Camera {
  id: number;
  camera_name: string;
  location_name: string;
  stream_url: string;
  status: string;
  resolution: string;
  is_recording: boolean;
  last_active: string;
  recording_count: number;
}

export default function CCTVScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedView, setSelectedView] = useState('grid');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [showRecordings, setShowRecordings] = useState(false);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
    
    const interval = setInterval(() => {
      fetchCameras();
      fetchAlerts();
      fetchLiveStreams();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cctv/cameras`);
      const data = await response.json();
      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cctv/alerts`);
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const response = await fetch(`${API_URL}/api/streams`);
      const data = await response.json();
      setLiveStreams(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  const fetchRecordings = async (cameraId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/cctv/cameras/${cameraId}/recordings`);
      const data = await response.json();
      setRecordings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const startLiveBroadcast = () => {
    router.push('/live-stream');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCameras(), fetchAlerts(), fetchLiveStreams()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'maintenance': return '#f59e0b';
      case 'inactive': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'maintenance': return 'MAINTENANCE';
      case 'inactive': return 'OFFLINE';
      default: return status.toUpperCase();
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const CameraCard = ({ camera }: { camera: Camera }) => {
    const isLive = liveStreams.some(s => s.cameraName === camera.camera_name);
    const statusColor = isLive ? '#E63939' : getStatusColor(camera.status);
    const statusText = isLive ? 'LIVE' : getStatusText(camera.status);
    
    return (
      <TouchableOpacity
        style={[styles.cameraCard, (isLive || camera.status === 'active') && styles.activeCard]}
        onPress={() => {
          setSelectedCamera(camera);
          setModalVisible(true);
          fetchRecordings(camera.id);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cameraThumbnail}>
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
            style={styles.thumbnailGradient}
          >
            <Ionicons name="videocam" size={40} color="white" />
          </LinearGradient>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        
        <View style={styles.cameraInfo}>
          <Text style={styles.cameraName}>{camera.camera_name}</Text>
          <Text style={styles.cameraLocation}>{camera.location_name}</Text>
          <View style={styles.cameraStats}>
            <View style={styles.statItem}>
              <Ionicons name="analytics-outline" size={10} color="#64748b" />
              <Text style={styles.statText}>{camera.resolution}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="recording-outline" size={10} color="#64748b" />
              <Text style={styles.statText}>{camera.recording_count || 0} recordings</Text>
            </View>
          </View>
          <Text style={styles.lastActive}>Last: {formatTime(camera.last_active)}</Text>
        </View>
        
        {camera.is_recording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E63939" />
          <Text style={styles.loadingText}>Loading cameras...</Text>
        </View>
      </LinearGradient>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.is_viewed).length;
  const activeLiveStreams = liveStreams.length;

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>CCTV Monitoring</Text>
            <Text style={styles.subtitle}>
              {cameras.length} Cameras • {activeLiveStreams} Live • {unreadAlerts} Alerts
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowAlerts(!showAlerts)}>
              <Ionicons name="notifications" size={24} color={unreadAlerts > 0 ? '#E63939' : '#fff'} />
              {unreadAlerts > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{unreadAlerts}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setSelectedView(selectedView === 'grid' ? 'list' : 'grid')}>
              <Ionicons name={selectedView === 'grid' ? 'list-outline' : 'grid-outline'} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.liveButton} onPress={startLiveBroadcast}>
              <LinearGradient colors={['#E63939', '#b91c1c']} style={styles.liveButtonGradient}>
                <Ionicons name="radio" size={18} color="#fff" />
                <Text style={styles.liveButtonText}>Start Live</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Live Streams Banner */}
        {activeLiveStreams > 0 && (
          <TouchableOpacity style={styles.liveBanner} onPress={() => Alert.alert('Live Streams', `${activeLiveStreams} active streams available`)}>
            <LinearGradient colors={['#E63939', '#b91c1c']} style={styles.liveBannerGradient}>
              <View style={styles.liveBannerContent}>
                <View style={styles.liveBannerIcon}>
                  <View style={styles.liveDotLarge} />
                  <Ionicons name="eye" size={20} color="#fff" />
                </View>
                <View style={styles.liveBannerText}>
                  <Text style={styles.liveBannerTitle}>{activeLiveStreams} Active Live {activeLiveStreams === 1 ? 'Stream' : 'Streams'}</Text>
                  <Text style={styles.liveBannerSubtitle}>Tap to watch live broadcasts</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Alerts Section */}
        {showAlerts && alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            <Text style={styles.alertsTitle}>Recent Alerts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {alerts.slice(0, 5).map((alert) => (
                <TouchableOpacity
                  key={alert.id}
                  style={[styles.alertCard, !alert.is_viewed && styles.alertCardUnread]}
                  onPress={async () => {
                    await fetch(`${API_URL}/api/cctv/alerts/${alert.id}/view`, { method: 'PUT' });
                    fetchAlerts();
                  }}
                >
                  <Ionicons name="alert-circle" size={20} color="#E63939" />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{alert.incident_type || 'Motion Detected'}</Text>
                    <Text style={styles.alertText}>{alert.camera_name}</Text>
                    <Text style={styles.alertTime}>{formatTime(alert.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Cameras Grid/List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.camerasContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
          }
        >
          {cameras.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="videocam-off" size={60} color="#334155" />
              <Text style={styles.emptyText}>No cameras found</Text>
              <Text style={styles.emptySubtext}>Tap "Start Live" to begin broadcasting</Text>
            </View>
          ) : selectedView === 'grid' ? (
            <View style={styles.gridContainer}>
              {cameras.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {cameras.map((camera) => {
                const isLive = liveStreams.some(s => s.cameraName === camera.camera_name);
                return (
                  <TouchableOpacity
                    key={camera.id}
                    style={styles.listItem}
                    onPress={() => {
                      setSelectedCamera(camera);
                      setModalVisible(true);
                      fetchRecordings(camera.id);
                    }}
                  >
                    <View style={[styles.listStatusDot, { backgroundColor: isLive ? '#E63939' : getStatusColor(camera.status) }]} />
                    <View style={styles.listContent}>
                      <Text style={styles.listName}>{camera.camera_name}</Text>
                      <Text style={styles.listLocation}>{camera.location_name}</Text>
                      <View style={styles.listStats}>
                        <Text style={styles.listResolution}>{camera.resolution}</Text>
                        <Text style={styles.listRecordings}>{camera.recording_count || 0} recordings</Text>
                      </View>
                    </View>
                    {(camera.status === 'active' || isLive) && (
                      <Ionicons name="play-circle" size={32} color={isLive ? "#E63939" : "#10b981"} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Camera Detail Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          {selectedCamera && (
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{selectedCamera.camera_name}</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalAction} onPress={() => setShowRecordings(!showRecordings)}>
                    <Ionicons name="list-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalVideoContainer}>
                {selectedCamera.stream_url ? (
                  <Video
                    source={{ uri: selectedCamera.stream_url }}
                    style={styles.modalVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                  />
                ) : (
                  <View style={styles.offlineContainer}>
                    <Ionicons name="videocam-off" size={60} color="#64748b" />
                    <Text style={styles.offlineText}>No Stream Available</Text>
                  </View>
                )}
                {(selectedCamera.status === 'active' || liveStreams.some(s => s.cameraName === selectedCamera.camera_name)) && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color="#64748b" />
                  <Text style={styles.infoText}>{selectedCamera.location_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="analytics-outline" size={20} color="#64748b" />
                  <Text style={styles.infoText}>Resolution: {selectedCamera.resolution}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color="#64748b" />
                  <Text style={styles.infoText}>Last active: {formatTime(selectedCamera.last_active)}</Text>
                </View>
              </View>

              {showRecordings && (
                <View style={styles.recordingsContainer}>
                  <Text style={styles.recordingsTitle}>Recent Recordings</Text>
                  <ScrollView horizontal>
                    {recordings.length > 0 ? (
                      recordings.map((rec) => (
                        <View key={rec.id} style={styles.recordingCard}>
                          <Ionicons name="videocam" size={24} color="#E63939" />
                          <Text style={styles.recordingDate}>
                            {new Date(rec.start_time).toLocaleDateString()}
                          </Text>
                          <Text style={styles.recordingDuration}>{formatDuration(rec.duration)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noRecordings}>No recordings yet</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity style={styles.reportButton} onPress={() => router.push('/camera')}>
                <Ionicons name="alert-circle" size={20} color="#fff" />
                <Text style={styles.reportButtonText}>Report Incident from this Camera</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </Modal>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconButton: { padding: 8, position: 'relative' },
  liveButton: { borderRadius: 25, overflow: 'hidden' },
  liveButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  liveButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  alertBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#E63939',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  alertBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  liveBanner: { marginHorizontal: 20, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  liveBannerGradient: { padding: 12 },
  liveBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveBannerIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDotLarge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  liveBannerText: { flex: 1 },
  liveBannerTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  liveBannerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  alertsContainer: { paddingHorizontal: 20, marginBottom: 16 },
  alertsTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    gap: 10,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#334155',
  },
  alertCardUnread: { borderColor: '#E63939', backgroundColor: 'rgba(230, 57, 57, 0.1)' },
  alertContent: { flex: 1 },
  alertTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  alertText: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  alertTime: { color: '#64748b', fontSize: 8, marginTop: 2 },

  camerasContainer: { padding: 16, paddingBottom: 100 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cameraCard: {
    width: (width - 48) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeCard: { borderColor: '#E63939', borderWidth: 2 },
  cameraThumbnail: { height: 120, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  thumbnailGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cameraInfo: { padding: 10 },
  cameraName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  cameraLocation: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  cameraStats: { flexDirection: 'row', gap: 8, marginTop: 6 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statText: { color: '#64748b', fontSize: 9 },
  lastActive: { color: '#475569', fontSize: 8, marginTop: 4 },
  recordingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E63939',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  recordingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  recordingText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },

  listContainer: { gap: 12 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  listStatusDot: { width: 8, height: 8, borderRadius: 4 },
  listContent: { flex: 1 },
  listName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  listLocation: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  listStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  listResolution: { color: '#64748b', fontSize: 10 },
  listRecordings: { color: '#64748b', fontSize: 10 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#64748b', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#475569', fontSize: 12, marginTop: 8 },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  modalClose: { padding: 5 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 16 },
  modalAction: { padding: 5 },
  modalVideoContainer: { width: width, height: height * 0.4, backgroundColor: '#000', position: 'relative' },
  modalVideo: { width: '100%', height: '100%' },
  offlineContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#64748b', marginTop: 12 },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E63939' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalInfo: { padding: 20, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { color: '#fff', fontSize: 14 },
  recordingsContainer: { paddingHorizontal: 20, marginTop: 10, marginBottom: 20 },
  recordingsTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  recordingCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recordingDate: { color: '#94a3b8', fontSize: 10, marginTop: 6 },
  recordingDuration: { color: '#64748b', fontSize: 8, marginTop: 2 },
  noRecordings: { color: '#64748b', fontSize: 12 },
  reportButton: {
    backgroundColor: '#E63939',
    margin: 20,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});