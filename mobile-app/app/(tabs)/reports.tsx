import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, StyleSheet, 
  ActivityIndicator, RefreshControl, TouchableOpacity 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, Calendar, MapPin, ChevronRight } from 'lucide-react-native';

const API_URL = 'http://192.168.137.1:5000'; // የአንተን IP አድራሻ ተጠቀም

export default function ReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_URL}/api/incidents`);
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9}>
      <Image 
        source={{ uri: `${API_URL}/uploads/${item.image_name}` }} 
        style={styles.image}
        onError={(e) => console.log('Image Load Error')}
      />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.type}>{item.type}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: item.priority === 'High' ? '#fee2e2' : '#fef3c7' }]}>
            <Text style={[styles.priorityText, { color: item.priority === 'High' ? '#ef4444' : '#f59e0b' }]}>
              {item.priority}
            </Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description || "No description provided."}
        </Text>

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Calendar size={12} color="#64748b" />
            <Text style={styles.footerText}>{new Date(item.timestamp).toLocaleDateString()}</Text>
          </View>
          <View style={styles.footerItem}>
            <MapPin size={12} color="#64748b" />
            <Text style={styles.footerText}>Addis Ababa</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color="#cbd5e1" style={{ marginRight: 10 }} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.topHeader}>
        <Text style={styles.title}>Incident Logs</Text>
        <Text style={styles.subtitle}>{reports.length} Reports Found</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <ShieldAlert size={50} color="#334155" />
              <Text style={styles.emptyText}>No reports yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 5, fontWeight: 'bold' },
  list: { padding: 15, paddingBottom: 100 },
  card: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    marginBottom: 15, 
    alignItems: 'center',
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  image: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#f1f5f9' },
  content: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  type: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '900' },
  description: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  footer: { flexDirection: 'row', gap: 15 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#64748b', marginTop: 10, fontWeight: 'bold' }
});