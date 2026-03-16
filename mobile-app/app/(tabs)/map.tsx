import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const mockIncidents = [
  { id: 1, lat: 9.0300, lng: 38.7400, title: 'Car Accident (High)' },
  { id: 2, lat: 9.0350, lng: 38.7500, title: 'Fire Detected (Critical)' },
];

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Live Incident Map</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 9.0300,
          longitude: 38.7400,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}>
        {mockIncidents.map(inc => (
          <Marker
            key={inc.id}
            coordinate={{ latitude: inc.lat, longitude: inc.lng }}
            title={inc.title}
            pinColor="#E63939"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#fff', padding: 15, textAlign: 'center' },
  map: { flex: 1 },
});