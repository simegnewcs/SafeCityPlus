import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const tipsData = [
  {
    category: '🔥 Fire Safety',
    tips: [
      'Stay low and crawl under smoke',
      'Never use elevator during fire',
      'Call 911 or 907 immediately',
      'Stop-Drop-Roll if clothes catch fire',
    ],
  },
  {
    category: '🚗 Road Accident',
    tips: [
      'Pull over safely and turn on hazard lights',
      'Check for injuries before moving anyone',
      'Take photos before moving vehicles',
      'Call police (991) and ambulance (907)',
    ],
  },
  {
    category: '🌊 Flooding',
    tips: [
      'Move to higher ground immediately',
      'Avoid walking or driving through water',
      'Turn off electricity if water enters home',
      'Listen to radio for updates',
    ],
  },
  {
    category: '🩹 Medical Emergency',
    tips: [
      'Do not move the person unless necessary',
      'Keep them warm and calm',
      'Call ambulance (907) and describe symptoms',
      'Perform CPR only if trained',
    ],
  },
  {
    category: '🌍 Earthquake',
    tips: [
      'Drop, Cover, Hold On',
      'Stay away from windows and heavy objects',
      'After shaking, check for gas leaks',
      'Follow official alerts on radio/TV',
    ],
  },
];

export default function TipsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Emergency Tips</Text>
      <Text style={styles.subHeader}>Prepared by Addis Ababa Safety Authority</Text>

      {tipsData.map((item, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.category}>{item.category}</Text>
          {item.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>Always call official numbers: 907 (Ambulance), 991 (Police), 993 (Fire)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540', padding: 15 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subHeader: { color: '#94a3b8', marginBottom: 25 },
  card: { backgroundColor: '#1E3A5F', padding: 20, borderRadius: 16, marginBottom: 15 },
  category: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tipText: { color: '#ccc', fontSize: 16, marginLeft: 10, flex: 1 },
  footer: { color: '#ffcc00', textAlign: 'center', fontWeight: '600', marginTop: 20, marginBottom: 40 },
});