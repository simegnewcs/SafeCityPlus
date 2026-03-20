import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

const API_URL = 'http://192.168.137.1:5000'; // የአንተን IP አድራሻ ተጠቀም

export default function MapScreen() {
  const [incidents, setIncidents] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // 1. የተጠቃሚውን የቆመበት ቦታ መፍቀድ እና ማግኘት
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      let userLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // 2. አደጋዎችን ከባክ-ኤንድ ማምጣት
      fetchIncidents();
    })();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      setIncidents(data);
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{marginTop: 10, color: '#64748b'}}>Loading Live Map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={location}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {incidents.map((incident: any) => (
          <Marker
            key={incident.id}
            coordinate={{
              latitude: parseFloat(incident.latitude),
              longitude: parseFloat(incident.longitude),
            }}
            pinColor={incident.priority === 'High' ? '#ef4444' : '#f59e0b'}
          >
            <Callout onPress={() => router.push('/(tabs)/reports')}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{incident.type}</Text>
                <Text style={styles.calloutDesc}>{incident.description}</Text>
                <Text style={styles.calloutPriority}>Priority: {incident.priority}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        <Text style={styles.headerText}>Emergency Heatmap</Text>
        <Text style={styles.subHeaderText}>{incidents.length} Active Incidents</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerText: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  subHeaderText: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 2, textTransform: 'uppercase' },
  callout: { width: 150, padding: 5 },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, color: '#1e293b' },
  calloutDesc: { fontSize: 11, color: '#64748b', marginVertical: 2 },
  calloutPriority: { fontSize: 10, fontWeight: 'bold', color: '#ef4444' }
});