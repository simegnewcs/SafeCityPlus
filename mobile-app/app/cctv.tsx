import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Dimensions,
  Modal, FlatList, Animated, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://192.168.137.1:5000';

// Mock CCTV camera data
const mockCameras = [
  {
    id: 1,
    name: 'Downtown Intersection',
    location: 'Bole, Addis Ababa',
    status: 'active',
    streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1546706374-eb7bdfd1a857?w=400',
    resolution: '1080p',
    lastActive: '2 min ago',
    incidents: 12
  },
  {
    id: 2,
    name: 'Highway 101',
    location: 'Mexico Road',
    status: 'active',
    streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1546706374-eb7bdfd1a857?w=400',
    resolution: '720p',
    lastActive: '5 min ago',
    incidents: 8
  },
  {
    id: 3,
    name: 'Central Park',
    location: 'Piassa, Addis Ababa',
    status: 'maintenance',
    streamUrl: null,
    thumbnail: null,
    resolution: '1080p',
    lastActive: '2 hours ago',
    incidents: 3
  },
  {
    id: 4,
    name: 'Airport Terminal',
    location: 'Bole International Airport',
    status: 'active',
    streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1546706374-eb7bdfd1a857?w=400',
    resolution: '4K',
    lastActive: '1 min ago',
    incidents: 5
  }
];

export default function CCTVScreen() {
  const [cameras, setCameras] = useState(mockCameras);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedView, setSelectedView] = useState('grid'); // 'grid', 'list'
  
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 1000);

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'maintenance':
        return '#f59e0b';
      case 'offline':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Live';
      case 'maintenance':
        return 'Maintenance';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  };

  const CameraCard = ({ camera }: { camera: any }) => (
    <TouchableOpacity
      style={styles.cameraCard}
      onPress={() => {
        if (camera.status === 'active') {
          setSelectedCamera(camera);
          setModalVisible(true);
        }
      }}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: camera.thumbnail || 'https://via.placeholder.com/300x200/1e293b/64748b?text=No+Preview' }}
        style={styles.cameraThumbnail}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.thumbnailOverlay}
      >
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(camera.status) }]} />
          <Text style={styles.statusText}>{getStatusText(camera.status)}</Text>
        </View>
        <View style={styles.cameraInfo}>
          <Text style={styles.cameraName}>{camera.name}</Text>
          <View style={styles.cameraDetails}>
            <Ionicons name="location-outline" size={12} color="#94a3b8" />
            <Text style={styles.cameraLocation}>{camera.location}</Text>
          </View>
          <View style={styles.cameraStats}>
            <View style={styles.statItem}>
              <Ionicons name="analytics-outline" size={12} color="#94a3b8" />
              <Text style={styles.statText}>{camera.resolution}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="warning-outline" size={12} color="#94a3b8" />
              <Text style={styles.statText}>{camera.incidents} incidents</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const CameraListItem = ({ camera }: { camera: any }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        if (camera.status === 'active') {
          setSelectedCamera(camera);
          setModalVisible(true);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.listStatusDot, { backgroundColor: getStatusColor(camera.status) }]} />
      <View style={styles.listContent}>
        <Text style={styles.listName}>{camera.name}</Text>
        <View style={styles.listDetails}>
          <Ionicons name="location-outline" size={12} color="#64748b" />
          <Text style={styles.listLocation}>{camera.location}</Text>
        </View>
        <View style={styles.listStats}>
          <Text style={styles.listResolution}>{camera.resolution}</Text>
          <Text style={styles.listIncidents}>{camera.incidents} incidents</Text>
          <Text style={styles.listLastActive}>Last: {camera.lastActive}</Text>
        </View>
      </View>
      {camera.status === 'active' && (
        <Ionicons name="play-circle" size={32} color="#E63939" />
      )}
    </TouchableOpacity>
  );

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

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>CCTV Monitoring</Text>
            <Text style={styles.subtitle}>{cameras.length} Cameras Online</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setSelectedView(selectedView === 'grid' ? 'list' : 'grid')}
            >
              <Ionicons
                name={selectedView === 'grid' ? 'list-outline' : 'grid-outline'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={24} color="#E63939" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Summary */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContainer}
        >
          <View style={styles.statBox}>
            <Ionicons name="videocam" size={20} color="#10b981" />
            <Text style={styles.statBoxValue}>{cameras.filter(c => c.status === 'active').length}</Text>
            <Text style={styles.statBoxLabel}>Active</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="construct" size={20} color="#f59e0b" />
            <Text style={styles.statBoxValue}>{cameras.filter(c => c.status === 'maintenance').length}</Text>
            <Text style={styles.statBoxLabel}>Maintenance</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <Text style={styles.statBoxValue}>24</Text>
            <Text style={styles.statBoxLabel}>Alerts Today</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="analytics" size={20} color="#3b82f6" />
            <Text style={styles.statBoxValue}>98%</Text>
            <Text style={styles.statBoxLabel}>Uptime</Text>
          </View>
        </ScrollView>

        {/* Cameras Grid/List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.camerasContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
          }
        >
          {selectedView === 'grid' ? (
            <View style={styles.gridContainer}>
              {cameras.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {cameras.map((camera) => (
                <CameraListItem key={camera.id} camera={camera} />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Video Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {selectedCamera && (
                <View>
                  <Text style={styles.modalTitle}>{selectedCamera.name}</Text>
                  <Text style={styles.modalSubtitle}>{selectedCamera.location}</Text>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalAction}>
                  <Ionicons name="expand-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction}>
                  <Ionicons name="alert-circle-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCamera && selectedCamera.status === 'active' && (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: selectedCamera.streamUrl }}
                  style={styles.videoPlayer}
                  useNativeControls
                  resizeMode="contain"
                  isLooping
                  shouldPlay
                />
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
            )}

            <View style={styles.modalInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="analytics-outline" size={20} color="#64748b" />
                <Text style={styles.infoText}>Resolution: {selectedCamera?.resolution}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#64748b" />
                <Text style={styles.infoText}>Last active: {selectedCamera?.lastActive}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="warning-outline" size={20} color="#64748b" />
                <Text style={styles.infoText}>Incidents detected: {selectedCamera?.incidents}</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.reportButton}>
                <Ionicons name="alert-circle" size={20} color="#fff" />
                <Text style={styles.reportButtonText}>Report Incident</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.recordButton}>
                <Ionicons name="recording-outline" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 12 },
  viewToggle: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 10 },
  addButton: { padding: 8 },

  // Stats
  statsScroll: { maxHeight: 100 },
  statsContainer: { paddingHorizontal: 20, gap: 12, paddingBottom: 10 },
  statBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBoxValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  statBoxLabel: { color: '#94a3b8', fontSize: 10, marginTop: 2 },

  // Grid View
  camerasContainer: { padding: 16, paddingBottom: 100 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cameraCard: {
    width: (width - 48) / 2,
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraThumbnail: { width: '100%', height: '100%' },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cameraInfo: { gap: 4 },
  cameraName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  cameraDetails: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cameraLocation: { color: '#94a3b8', fontSize: 10 },
  cameraStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statText: { color: '#94a3b8', fontSize: 9 },

  // List View
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
  listName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  listDetails: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  listLocation: { color: '#94a3b8', fontSize: 11 },
  listStats: { flexDirection: 'row', gap: 12 },
  listResolution: { color: '#64748b', fontSize: 10 },
  listIncidents: { color: '#64748b', fontSize: 10 },
  listLastActive: { color: '#64748b', fontSize: 10 },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  closeButton: { padding: 5 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { color: '#94a3b8', fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 16 },
  modalAction: { padding: 5 },
  videoContainer: {
    width: width,
    height: height * 0.4,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: { width: '100%', height: '100%' },
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#E63939',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  recordButton: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});