import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
  TextInput, Modal, ScrollView, Dimensions, Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
const API_URL = 'http://10.161.68.44:5000';

// Location name mapping for common areas
const locationNames: { [key: string]: string } = {
  '11.5967,37.3949': 'Bahir Dar University, Poly Campus',
  '11.5968,37.3950': 'Bahir Dar University, Main Campus',
  '11.5966,37.3949': 'Polytechnic College, Bahir Dar',
  '11.5982,37.3977': 'Bahir Dar Stadium Area',
  '11.5969,37.3970': 'Bahir Dar City Center',
  '11.6019,37.3989': 'Bahir Dar Airport Road',
  '11.5983,37.3975': 'Bahir Dar Market Area',
  '11.5967,37.3948': 'Tana Hayik, Bahir Dar',
  '11.5968,37.3951': 'Bahir Dar - Gondar Road',
  '9.0117,38.7468': 'Bole, Addis Ababa',
  '9.0300,38.7400': 'Mexico Road, Addis Ababa',
  '9.0305,38.7500': 'Piassa, Addis Ababa',
  '8.9777,38.7993': 'Bole International Airport',
};

// Memoized location name function
const getLocationName = (lat: number, lng: number): string => {
  if (!lat || !lng) return 'Unknown location';
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const exactMatch = locationNames[key];
  if (exactMatch) return exactMatch;
  for (const [coord, name] of Object.entries(locationNames)) {
    const [cLat, cLng] = coord.split(',').map(Number);
    if (Math.abs(lat - cLat) < 0.01 && Math.abs(lng - cLng) < 0.01) {
      return name;
    }
  }
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
};

// Memoized date formatter
const formatDateTime = (dateString: string): { relative: string; absolute: string } => {
  if (!dateString) return { relative: 'Unknown', absolute: 'Unknown' };
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMs / 1000 / 3600);
  const diffDays = Math.floor(diffMs / 1000 / 86400);
  
  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins} min ago`;
  else if (diffHours < 24) relative = `${diffHours} hr ago`;
  else if (diffDays < 7) relative = `${diffDays} day ago`;
  else relative = `${Math.floor(diffDays / 7)} week ago`;
  
  const absolute = date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  
  return { relative, absolute };
};

// Memoized Incident Card Component
const IncidentCard = React.memo(({ item, onPress, isGuest }: any) => {
  const isVideo = item.media_type === 'video';
  const mediaUrl = `${API_URL}/uploads/${item.media_name}`;
  const videoDuration = item.video_duration || 0;
  const dateInfo = formatDateTime(item.created_at);
  const displayLocation = getLocationName(
    parseFloat(item.latitude), 
    parseFloat(item.longitude)
  );
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      <View style={styles.mediaContainer}>
        {item.media_name ? (
          isVideo ? (
            <View style={styles.videoPreviewContainer}>
              <Video
                source={{ uri: mediaUrl }}
                style={styles.videoPreview}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isLooping={false}
                useNativeControls={false}
              />
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={30} color="white" />
              </View>
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={12} color="white" />
                {videoDuration > 0 && (
                  <Text style={styles.durationText}>
                    {`${Math.floor(videoDuration / 60)}:${(videoDuration % 60).toString().padStart(2, '0')}`}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.image} />
          )
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="camera" size={30} color="#64748b" />
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
            <Ionicons name="time-outline" size={12} color="#64748b" />
            <Text style={styles.footerText}>{dateInfo.relative}</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="location-outline" size={12} color="#64748b" />
            <Text style={styles.footerText} numberOfLines={1}>
              {displayLocation.length > 20 ? displayLocation.substring(0, 17) + '...' : displayLocation}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.mediaTypeBadge}>
          {isVideo ? (
            <>
              <Ionicons name="videocam" size={10} color="#E63939" />
              <Text style={styles.mediaTypeText}>Video</Text>
            </>
          ) : (
            <>
              <Ionicons name="camera" size={10} color="#3b82f6" />
              <Text style={[styles.mediaTypeText, { color: '#3b82f6' }]}>Photo</Text>
            </>
          )}
        </View>

        {isGuest && item.reporter_name && (
          <View style={styles.reporterInfo}>
            <Ionicons name="person-outline" size={10} color="#94a3b8" />
            <Text style={styles.reporterText}>By: {item.reporter_name.split(' ')[0]}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color="#cbd5e1" style={{ marginRight: 10 }} />
    </TouchableOpacity>
  );
});

// Helper functions for colors
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'resolved': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'in progress': return '#3b82f6';
    default: return '#64748b';
  }
};

const getStatusBgColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'resolved': return '#d1fae5';
    case 'pending': return '#fed7aa';
    case 'in progress': return '#dbeafe';
    default: return '#f1f5f9';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'critical': return '#dc2626';
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'normal': return '#10b981';
    default: return '#64748b';
  }
};

const getPriorityBgColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'critical': return '#fee2e2';
    case 'high': return '#fee2e2';
    case 'medium': return '#fed7aa';
    case 'normal': return '#d1fae5';
    default: return '#f1f5f9';
  }
};

export default function ReportsScreen() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const router = useRouter();

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkUserMode();
    }, [])
  );

  useEffect(() => {
    applyFilters();
  }, [reports, searchQuery, filterType, filterPriority, filterStatus]);

  const checkUserMode = async () => {
    try {
      const guest = await AsyncStorage.getItem('isGuest');
      const userData = await AsyncStorage.getItem('userData');
      
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
      const userData = await AsyncStorage.getItem('userData');
      const user = JSON.parse(userData!);
      
      const response = await fetch(`${API_URL}/api/incidents/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${user.id}` }
      });
      
      const data = await response.json();
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
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];
    
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id?.toString().includes(searchQuery)
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.media_type === filterType);
    }
    
    if (filterPriority !== 'all') {
      filtered = filtered.filter(item => 
        item.priority?.toLowerCase() === filterPriority.toLowerCase()
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        item.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }
    
    setFilteredReports(filtered);
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

  const handleReportPress = useCallback((report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  }, []);

  const FilterChip = useCallback(({ label, value, current, onPress, color }) => (
    <TouchableOpacity
      style={[styles.filterChip, current === value && { backgroundColor: color + '20', borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, current === value && { color: color }]}>{label}</Text>
    </TouchableOpacity>
  ), []);

  const renderItem = useCallback(({ item }) => (
    <IncidentCard item={item} onPress={handleReportPress} isGuest={isGuest} />
  ), [isGuest, handleReportPress]);

  const keyExtractor = useCallback((item) => item.id?.toString() || Math.random().toString(), []);

  const GuestModeHeader = useCallback(() => (
    <View style={styles.guestHeader}>
      <Ionicons name="alert-triangle-outline" size={16} color="#f59e0b" />
      <Text style={styles.guestHeaderText}>
        You're viewing all incidents. Create an account to track your own reports.
      </Text>
    </View>
  ), []);

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.center}>
      <Ionicons name="shield-outline" size={60} color="#334155" />
      <Text style={styles.emptyText}>
        {searchQuery || filterType !== 'all' || filterPriority !== 'all' || filterStatus !== 'all'
          ? 'No matching incidents found'
          : isGuest 
            ? 'No incidents reported yet.' 
            : 'You haven\'t reported any incidents yet.'}
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
  ), [searchQuery, filterType, filterPriority, filterStatus, isGuest]);

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
          {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'} Found
        </Text>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="options-outline" size={20} color={showFilters ? "#E63939" : "#64748b"} />
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Media:</Text>
              <FilterChip label="All" value="all" current={filterType} onPress={() => setFilterType('all')} color="#64748b" />
              <FilterChip label="Photo" value="image" current={filterType} onPress={() => setFilterType('image')} color="#3b82f6" />
              <FilterChip label="Video" value="video" current={filterType} onPress={() => setFilterType('video')} color="#E63939" />
            </View>
          </ScrollView>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Priority:</Text>
              <FilterChip label="High" value="high" current={filterPriority} onPress={() => setFilterPriority('high')} color="#ef4444" />
              <FilterChip label="Medium" value="medium" current={filterPriority} onPress={() => setFilterPriority('medium')} color="#f59e0b" />
              <FilterChip label="Low" value="low" current={filterPriority} onPress={() => setFilterPriority('low')} color="#10b981" />
            </View>
          </ScrollView>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <FilterChip label="Pending" value="pending" current={filterStatus} onPress={() => setFilterStatus('pending')} color="#f59e0b" />
              <FilterChip label="In Progress" value="in progress" current={filterStatus} onPress={() => setFilterStatus('in progress')} color="#3b82f6" />
              <FilterChip label="Resolved" value="resolved" current={filterStatus} onPress={() => setFilterStatus('resolved')} color="#10b981" />
            </View>
          </ScrollView>
          
          {(filterType !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={() => {
              setSearchQuery('');
              setFilterType('all');
              setFilterPriority('all');
              setFilterStatus('all');
              setShowFilters(false);
            }}>
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isGuest && reports.length > 0 && <GuestModeHeader />}

      <FlatList
        data={filteredReports}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, filteredReports.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
        }
        ListEmptyComponent={ListEmptyComponent}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 110,
          offset: 110 * index,
          index,
        })}
      />

      {/* Detail Modal - Keep as is from previous version */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDetailModal}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.modalGradient}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Incident Details</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedReport && (
                  <View style={styles.modalBody}>
                    {selectedReport.media_name && (
                      <View style={styles.modalMedia}>
                        {selectedReport.media_type === 'video' ? (
                          <View style={styles.modalVideoContainer}>
                            <Video
                              source={{ uri: `${API_URL}/uploads/${selectedReport.media_name}` }}
                              style={styles.modalVideo}
                              useNativeControls
                              resizeMode={ResizeMode.CONTAIN}
                              shouldPlay
                            />
                          </View>
                        ) : (
                          <Image 
                            source={{ uri: `${API_URL}/uploads/${selectedReport.media_name}` }} 
                            style={styles.modalImage}
                          />
                        )}
                      </View>
                    )}
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Type</Text>
                      <Text style={styles.modalValue}>{selectedReport.type || 'Unknown'}</Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Priority</Text>
                      <Text style={[styles.modalValue, { color: getPriorityColor(selectedReport.priority) }]}>
                        {selectedReport.priority || 'Normal'}
                      </Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Status</Text>
                      <Text style={[styles.modalValue, { color: getStatusColor(selectedReport.status) }]}>
                        {selectedReport.status || 'Pending'}
                      </Text>
                    </View>
                    
                    {selectedReport.description && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>Description</Text>
                        <Text style={styles.modalValueText}>{selectedReport.description}</Text>
                      </View>
                    )}
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Location</Text>
                      <Text style={styles.modalValue}>
                        {getLocationName(
                          parseFloat(selectedReport.latitude), 
                          parseFloat(selectedReport.longitude)
                        )}
                      </Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Reported</Text>
                      <Text style={styles.modalValue}>
                        {formatDateTime(selectedReport.created_at).absolute}
                      </Text>
                    </View>
                    
                    {selectedReport.all_detections && selectedReport.all_detections.length > 0 && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>AI Detections</Text>
                        <View style={styles.detectionList}>
                          {selectedReport.all_detections.map((detection, idx) => (
                            <View key={idx} style={styles.detectionItem}>
                              <Ionicons name="scan-outline" size={12} color="#E63939" />
                              <Text style={styles.detectionText}>{detection.ai_type}</Text>
                              <Text style={styles.detectionConfidence}>
                                {Math.round(detection.confidence * 100)}%
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 5, fontWeight: 'bold' },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  searchInput: { flex: 1, color: '#1e293b', fontSize: 14 },
  
  filtersPanel: { paddingHorizontal: 15, marginBottom: 10, gap: 10 },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  filterLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginRight: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  clearFiltersButton: { marginTop: 5, alignSelf: 'flex-start' },
  clearFiltersText: { fontSize: 12, color: '#E63939', fontWeight: '500' },
  
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
  videoPreviewContainer: { width: 70, height: 70, borderRadius: 15, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  videoPreview: { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
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
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '600' },
  mediaTypeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  mediaTypeText: { fontSize: 8, color: '#E63939', fontWeight: '500' },
  reporterInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
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
  guestHeaderText: { color: '#92400e', fontSize: 11, flex: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '85%' },
  modalGradient: { borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20, gap: 16 },
  modalMedia: { marginBottom: 10, alignItems: 'center' },
  modalImage: { width: width - 80, height: 200, borderRadius: 15, backgroundColor: '#1e293b' },
  modalVideoContainer: { width: width - 80, height: 200, borderRadius: 15, overflow: 'hidden', backgroundColor: '#000' },
  modalVideo: { width: '100%', height: '100%' },
  modalInfoRow: { gap: 6 },
  modalLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  modalValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  modalValueText: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  detectionList: { gap: 8, marginTop: 4 },
  detectionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', padding: 10, borderRadius: 10 },
  detectionText: { flex: 1, fontSize: 13, color: '#fff' },
  detectionConfidence: { fontSize: 11, color: '#E63939', fontWeight: 'bold' },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#334155' },
  closeModalButton: { backgroundColor: '#334155', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  closeModalText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});