import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity } from 'react-native';

const aiMockCCTV = [
  {
    id: '1',
    title: 'Bole Road - Major Car Accident',
    time: '3 min ago',
    location: 'Bole, Addis Ababa',
    type: 'Car Accident',
    confidence: '94%',
    severity: 'High',
  },
  {
    id: '2',
    title: 'Piassa Market - Fire Detected',
    time: '8 min ago',
    location: 'Piassa, Addis Ababa',
    type: 'Fire',
    confidence: '91%',
    severity: 'High',
  },
  {
    id: '3',
    title: 'Merkato - Medical Emergency',
    time: '14 min ago',
    location: 'Merkato, Addis Ababa',
    type: 'Medical Emergency',
    confidence: '85%',
    severity: 'Medium',
  },
  {
    id: '4',
    title: 'Mexico Square - Flooding',
    time: '27 min ago',
    location: 'Mexico Square, Addis Ababa',
    type: 'Flooding',
    confidence: '78%',
    severity: 'Low',
  },
  {
    id: '5',
    title: 'Arat Kilo - Traffic Collision',
    time: '41 min ago',
    location: 'Arat Kilo, Addis Ababa',
    type: 'Traffic Collision',
    confidence: '88%',
    severity: 'High',
  },
];

export default function CCTVScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Live CCTV Feed • AI Detection</Text>
      <Text style={styles.subHeader}>Real-time incidents from city cameras</Text>

      <FlatList
        data={aiMockCCTV}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: 'https://picsum.photos/id/' + (20 + parseInt(item.id)) + '/400/220' }} style={styles.image} />
            
            <View style={styles.info}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.location}>{item.location}</Text>
              
              <View style={styles.aiRow}>
                <Text style={styles.aiText}>AI: {item.type}</Text>
                <Text style={styles.confidence}>Confidence {item.confidence}</Text>
              </View>
              
              <Text style={[styles.severity, item.severity === 'High' ? styles.red : item.severity === 'Medium' ? styles.orange : styles.green]}>
                {item.severity} Priority
              </Text>
              
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', padding: 15 },
  header: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  subHeader: { color: '#94a3b8', marginBottom: 20 },
  card: { backgroundColor: '#1E3A5F', borderRadius: 16, overflow: 'hidden', marginBottom: 18 },
  image: { width: '100%', height: 200 },
  info: { padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  location: { color: '#ccc', marginBottom: 10 },
  aiRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  aiText: { color: '#ffcc00', fontSize: 16 },
  confidence: { color: '#fff', fontWeight: '600' },
  severity: { fontSize: 14, fontWeight: 'bold', padding: 6, borderRadius: 8, textAlign: 'center', marginBottom: 8 },
  red: { backgroundColor: '#E63939', color: '#fff' },
  orange: { backgroundColor: '#FB923C', color: '#fff' },
  green: { backgroundColor: '#4ADE80', color: '#000' },
  time: { color: '#94a3b8', fontSize: 12, textAlign: 'right' },
});