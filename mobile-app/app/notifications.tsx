import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, RefreshControl,
  Animated, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notificationService, Notification } from '../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserData();
    
    const unsubscribe = notificationService.subscribe((notifications) => {
      setNotifications(notifications);
    });

    return () => unsubscribe();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.id || null);
        if (user.id) {
          await notificationService.fetchNotifications(user.id);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (userId) {
      await notificationService.fetchNotifications(userId);
    }
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: number) => {
    await notificationService.markAsRead(notificationId);
  };

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return 'warning';
      case 'emergency':
        return 'alert-circle';
      case 'assignment':
        return 'checkmark-circle';
      default:
        return 'information-circle';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'incident':
        return '#f59e0b';
      case 'emergency':
        return '#ef4444';
      case 'assignment':
        return '#10b981';
      default:
        return '#3b82f6';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type and data
    if (notification.type === 'incident' && notification.data?.incidentId) {
      router.push(`/report-details?id=${notification.data.incidentId}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1845b0', '#1e293b']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E63939" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1845b0', '#1e293b']} style={styles.gradient}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllRead}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
          }
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#64748b" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyMessage}>
                You're all caught up! New notifications will appear here.
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.read && styles.unreadNotification
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { 
                  backgroundColor: `${getNotificationColor(notification.type)}20` 
                }]}>
                  <Ionicons 
                    name={getNotificationIcon(notification.type)} 
                    size={20} 
                    color={getNotificationColor(notification.type)} 
                  />
                </View>
                
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.read && styles.unreadTitle
                    ]}>
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  
                  <Text style={styles.notificationMessage} numberOfLines={2}>
                    {notification.message}
                  </Text>
                  
                  <Text style={styles.notificationTime}>
                    {formatTime(notification.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  markAllRead: { 
    color: '#E63939', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  scrollView: { flex: 1 },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: '#64748b', 
    fontSize: 16, 
    marginTop: 12 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 40,
    marginTop: 100
  },
  emptyTitle: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginTop: 16 
  },
  emptyMessage: { 
    color: '#64748b', 
    fontSize: 14, 
    textAlign: 'center', 
    lineHeight: 20, 
    marginTop: 8 
  },
  notificationItem: { 
    flexDirection: 'row', 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginVertical: 6,
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  unreadNotification: { 
    backgroundColor: '#1e293b',
    borderColor: '#E63939',
    borderWidth: 1.5
  },
  iconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  notificationContent: { 
    flex: 1 
  },
  notificationHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  notificationTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600', 
    flex: 1 
  },
  unreadTitle: { 
    color: '#fff', 
    fontWeight: '700' 
  },
  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#E63939' 
  },
  notificationMessage: { 
    color: '#94a3b8', 
    fontSize: 14, 
    lineHeight: 20, 
    marginBottom: 8 
  },
  notificationTime: { 
    color: '#64748b', 
    fontSize: 12 
  }
});
