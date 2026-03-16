import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SOSModal from '../modal';

export default function HomeScreen() {
  const [userName, setUserName] = useState('Citizen');
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadName = async () => {
      const name = await AsyncStorage.getItem('fullName');
      if (name) setUserName(name);
    };
    loadName();
  }, []);

  const handleSOSPress = () => setModalVisible(true);

  return (
    <View style={styles.container}>
      {/* Subtle Background */}
      <Image source={{ uri: 'https://picsum.photos/id/1015/800/800' }} style={styles.background} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <Text style={styles.logo}>SafeCity+</Text>
          <View style={styles.rightSide}>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <TouchableOpacity>
              <Text style={styles.bell}>🛎️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Banner */}
        <View style={styles.locationBanner}>
          <Text style={styles.locationText}>📍 Addis Ababa, Ethiopia</Text>
        </View>

        {/* HUGE SOS BUTTON */}
        <TouchableOpacity style={styles.sosButton} onPress={handleSOSPress} activeOpacity={0.8}>
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosSub}>PRESS FOR EMERGENCY</Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.cardsGrid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/reports')}>
            <Text style={styles.cardEmoji}>📋</Text>
            <Text style={styles.cardTitle}>My Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/cctv')}>
            <Text style={styles.cardEmoji}>📹</Text>
            <Text style={styles.cardTitle}>CCTV Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.cardEmoji}>🗺️</Text>
            <Text style={styles.cardTitle}>Live Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/tips')}>
            <Text style={styles.cardEmoji}>💡</Text>
            <Text style={styles.cardTitle}>Emergency Tips</Text>
          </TouchableOpacity>
        </View>

        {/* Live Updates */}
        <Text style={styles.sectionTitle}>Live AI Updates</Text>
        {[
          { title: 'Bole Road — Car Accident (High)', time: '3 min ago' },
          { title: 'Piassa — Fire Detected', time: '8 min ago' },
          { title: 'Merkato — Medical Emergency', time: '19 min ago' },
        ].map((item, index) => (
          <View key={index} style={styles.updateCard}>
            <Text style={styles.updateTitle}>{item.title}</Text>
            <Text style={styles.updateTime}>{item.time}</Text>
          </View>
        ))}
      </ScrollView>

      {/* SOS Modal */}
      <SOSModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540' },
  background: { position: 'absolute', width: '100%', height: '100%', opacity: 0.06 },
  scroll: { padding: 20, paddingBottom: 100 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  rightSide: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  greeting: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bell: { fontSize: 24 },

  locationBanner: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12, marginBottom: 25, alignItems: 'center' },
  locationText: { color: '#ffcc00', fontWeight: '600', fontSize: 15 },

  sosButton: {
    width: 260,
    height: 260,
    backgroundColor: '#E63939',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#E63939',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 25,
    marginBottom: 35,
  },
  sosText: { fontSize: 72, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  sosSub: { fontSize: 14, color: '#fff', marginTop: 6, fontWeight: '600' },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 15, marginBottom: 12 },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: {
    backgroundColor: '#1E3A5F',
    width: '48%',
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: 'center',
  },
  cardEmoji: { fontSize: 42, marginBottom: 6 },
  cardTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },

  updateCard: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  updateTitle: { color: '#fff', fontSize: 16, flex: 1 },
  updateTime: { color: '#94a3b8', fontSize: 13 },
});