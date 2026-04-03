import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Text, ActivityIndicator, Dimensions,
  TouchableOpacity, ScrollView, Modal, Animated, Platform
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://192.168.137.1:5000';

export default function MapScreen() {
  const [incidents, setIncidents] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [mapType, setMapType] = useState('standard'); // standard, satellite, hybrid
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showUserLocation, setShowUserLocation] = useState(true);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  
  const mapRef = useRef(null);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeMap();
    fetchIncidents();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const userLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      
      // Animate fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
      
    } catch (error) {
      console.error('Location error:', error);
      // Default to Addis Ababa
      setLocation({
        latitude: 9.03,
        longitude: 38.74,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      setIncidents(data);
      
      // Calculate stats
      const high = data.filter(i => i.priority === 'High' || i.priority === 'Critical').length;
      const medium = data.filter(i => i.priority === 'Medium').length;
      const low = data.filter(i => i.priority === 'Low' || i.priority === 'Normal').length;
      setStats({ total: data.length, high, medium, low });
      
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const centerToUserLocation = async () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const getMarkerColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getMarkerIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'alert-circle';
      case 'high': return 'warning';
      case 'medium': return 'time';
      default: return 'information-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const getMapStyle = () => {
    if (mapType === 'satellite') return 'satellite';
    if (mapType === 'hybrid') return 'hybrid';
    return 'standard';
  };

  const MapControls = () => (
    <View style={styles.controlsContainer}>
      {/* Map Type Selector */}
      <View style={styles.controlGroup}>
        <TouchableOpacity
          style={[styles.controlButton, mapType === 'standard' && styles.controlActive]}
          onPress={() => setMapType('standard')}
        >
          <Ionicons name="map-outline" size={20} color={mapType === 'standard' ? '#E63939' : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, mapType === 'satellite' && styles.controlActive]}
          onPress={() => setMapType('satellite')}
        >
          <Ionicons name="earth-outline" size={20} color={mapType === 'satellite' ? '#E63939' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Zoom Controls */}
      <View style={styles.controlGroup}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => mapRef.current?.animateToRegion({
            ...location,
            latitudeDelta: (location?.latitudeDelta || 0.05) / 1.5,
            longitudeDelta: (location?.longitudeDelta || 0.05) / 1.5,
          }, 500)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => mapRef.current?.animateToRegion({
            ...location,
            latitudeDelta: (location?.latitudeDelta || 0.05) * 1.5,
            longitudeDelta: (location?.longitudeDelta || 0.05) * 1.5,
          }, 500)}
        >
          <Ionicons name="remove" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* My Location Button */}
      <TouchableOpacity style={styles.controlButton} onPress={centerToUserLocation}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E63939" />
        <Text style={styles.loadingText}>Loading map data...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={location}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType={getMapStyle()}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
      >
        {/* Incident Markers */}
        {incidents.map((incident) => (
          incident.latitude && incident.longitude && (
            <Marker
              key={incident.id}
              coordinate={{
                latitude: parseFloat(incident.latitude),
                longitude: parseFloat(incident.longitude),
              }}
              pinColor={getMarkerColor(incident.priority)}
            >
              <Callout
                onPress={() => {
                  setSelectedIncident(incident);
                  setShowModal(true);
                }}
              >
                <View style={styles.callout}>
                  <View style={styles.calloutHeader}>
                    <Ionicons name={getMarkerIcon(incident.priority)} size={16} color={getMarkerColor(incident.priority)} />
                    <Text style={styles.calloutTitle}>{incident.type || 'Unknown Incident'}</Text>
                  </View>
                  <Text style={styles.calloutDesc} numberOfLines={2}>
                    {incident.description || 'No description available'}
                  </Text>
                  <View style={styles.calloutFooter}>
                    <Text style={styles.calloutPriority}>Priority: {incident.priority || 'Normal'}</Text>
                    <Text style={styles.calloutTime}>{formatDate(incident.created_at)}</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          )
        ))}
        
        {/* Heatmap Circles (optional) */}
        {showHeatmap && incidents.map((incident) => (
          incident.latitude && incident.longitude && (
            <Circle
              key={`heat-${incident.id}`}
              center={{
                latitude: parseFloat(incident.latitude),
                longitude: parseFloat(incident.longitude),
              }}
              radius={100}
              fillColor={`${getMarkerColor(incident.priority)}40`}
              strokeColor="transparent"
            />
          )
        ))}
      </MapView>

      {/* Header Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={styles.headerOverlay}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Emergency Map</Text>
            <Text style={styles.headerSubtitle}>{stats.total} Active Incidents</Text>
          </View>
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => setShowHeatmap(!showHeatmap)}
          >
            <Ionicons name={showHeatmap ? "flame" : "thermometer"} size={20} color="#E63939" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.statText}>High: {stats.high}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statText}>Medium: {stats.medium}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statText}>Low: {stats.low}</Text>
        </View>
      </View>

      {/* Map Controls */}
      <MapControls />

      {/* Incident Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedIncident?.type || 'Incident Details'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalPriority}>
                  <View style={[styles.priorityBadge, { backgroundColor: getMarkerColor(selectedIncident?.priority) + '20' }]}>
                    <Ionicons name={getMarkerIcon(selectedIncident?.priority)} size={16} color={getMarkerColor(selectedIncident?.priority)} />
                    <Text style={[styles.priorityText, { color: getMarkerColor(selectedIncident?.priority) }]}>
                      {selectedIncident?.priority || 'Normal'} Priority
                    </Text>
                  </View>
                </View>

                {selectedIncident?.description && (
                  <Text style={styles.modalDescription}>{selectedIncident.description}</Text>
                )}

                <View style={styles.modalInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={18} color="#64748b" />
                    <Text style={styles.infoText}>
                      {selectedIncident?.latitude && selectedIncident?.longitude 
                        ? `${parseFloat(selectedIncident.latitude).toFixed(6)}, ${parseFloat(selectedIncident.longitude).toFixed(6)}`
                        : 'Unknown location'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={18} color="#64748b" />
                    <Text style={styles.infoText}>
                      {formatDate(selectedIncident?.created_at)}
                    </Text>
                  </View>
                  {selectedIncident?.reporter_name && (
                    <View style={styles.infoRow}>
                      <Ionicons name="person-outline" size={18} color="#64748b" />
                      <Text style={styles.infoText}>Reported by: {selectedIncident.reporter_name}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.navigateButton}
                    onPress={() => {
                      if (selectedIncident?.latitude && selectedIncident?.longitude) {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedIncident.latitude},${selectedIncident.longitude}`;
                        Linking.openURL(url);
                      }
                    }}
                  >
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <Text style={styles.navigateText}>Get Directions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reportButton}
                    onPress={() => {
                      setShowModal(false);
                      router.push('/camera');
                    }}
                  >
                    <Ionicons name="alert-circle" size={18} color="#fff" />
                    <Text style={styles.reportText}>Report Incident</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: width, height: height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  
  // Header Overlay
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  statsButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 30,
  },
  
  // Stats Bar
  statsBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  
  // Map Controls
  controlsContainer: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -100 }],
    gap: 10,
  },
  controlGroup: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlActive: { backgroundColor: 'rgba(230, 57, 57, 0.2)' },
  
  // Callout
  callout: { width: 180, padding: 8 },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  calloutTitle: { fontWeight: 'bold', fontSize: 13, color: '#1e293b', flex: 1 },
  calloutDesc: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  calloutFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calloutPriority: { fontSize: 9, fontWeight: 'bold', color: '#ef4444' },
  calloutTime: { fontSize: 9, color: '#94a3b8' },
  
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '70%' },
  modalGradient: { borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  modalPriority: { alignItems: 'center', marginBottom: 16 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  priorityText: { fontSize: 12, fontWeight: 'bold' },
  modalDescription: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  modalInfo: { gap: 12, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { color: '#cbd5e1', fontSize: 13, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12 },
  navigateButton: { flex: 1, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navigateText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  reportButton: { flex: 1, backgroundColor: '#E63939', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reportText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});