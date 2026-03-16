import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity } from 'react-native';

const mockCCTV = [
  { id: '1', title: 'Bole Road - Car Accident', time: '2 min ago', type: 'Car Accident', confidence: '92%' },
  { id: '2', title: 'Piassa - Fire Detected', time: '7 min ago', type: 'Fire', confidence: '87%' },
  { id: '3', title: 'Mexico Square - Traffic Incident', time: '14 min ago', type: 'Accident', confidence: '78%' },
];

export default function CCTVScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Live CCTV Incidents Feed</Text>
      <FlatList
        data={mockCCTV}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Image source={{ uri: 'https://picsum.photos/300/200' }} style={styles.image} />
            <View style={styles.info}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.ai}>AI: {item.type} • {item.confidence}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', padding: 15 },
  header: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  card: { backgroundColor: '#1E3A5F', borderRadius: 12, overflow: 'hidden', marginBottom: 15 },
  image: { width: '100%', height: 180 },
  info: { padding: 15 },
  title: { fontSize: 17, fontWeight: '600', color: '#fff' },
  ai: { color: '#ffcc00', marginVertical: 4 },
  time: { color: '#94a3b8', fontSize: 12 },
});