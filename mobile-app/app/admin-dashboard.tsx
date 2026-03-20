// app/admin-dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '../utils/storage';
import { wsService } from '../services/websocket.service';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Types and Interfaces
interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface AIAnalysis {
  type: string;
  confidence: number;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  description?: string;
  objects?: Array<{
    class: string;
    confidence: number;
  }>;
}

interface EmergencyReport {
  id: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  location: Location;
  mediaType: 'image' | 'video';
  mediaUrl?: string;
  isGuest: boolean;
  userName?: string;
  userPhone?: string;
  timestamp: string;
  aiAnalysis: AIAnalysis;
  status: 'pending' | 'assigned' | 'resolved' | 'rejected';
  assignedResponder?: {
    id: string;
    name: string;
    type: 'police' | 'fire' | 'medical';
    assignedAt: string;
  };
  responderNotes?: string[];
  responseTime?: number; // in minutes
}

interface LiveStream {
  id: string;
  streamId: string;
  feedId: string;
  location: string;
  startedAt: string;
  viewerCount: number;
  status: 'active' | 'ended';
  thumbnail: string;
  aiAnalysis?: AIAnalysis;
}

interface Responder {
  id: string;
  name: string;
  type: 'police' | 'fire' | 'medical';
  status: 'available' | 'busy' | 'offline';
  location?: Location;
  currentIncident?: string;
}

interface SystemStats {
  totalIncidents: number;
  activeIncidents: number;
  resolvedToday: number;
  avgResponseTime: number;
  activeResponders: number;
  criticalIncidents: number;
}

export default function AdminDashboard() {
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'live' | 'pending' | 'assigned' | 'history' | 'responders'>('pending');
  const [selectedReport, setSelectedReport] = useState<EmergencyReport | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [responderNotes, setResponderNotes] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<SystemStats>({
    totalIncidents: 0,
    activeIncidents: 0,
    resolvedToday: 0,
    avgResponseTime: 0,
    activeResponders: 0,
    criticalIncidents: 0,
  });

  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadUserData();
    setupWebSocket();
    loadMockData();
    startAutoRefresh();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      wsService.disconnect();
    };
  }, []);

  useEffect(() => {
    updateStats();
  }, [reports, responders]);

  const loadUserData = async () => {
    try {
      const role = await storage.getItem('userRole');
      const name = await storage.getItem('fullName');
      const id = await storage.getItem('userId');
      setUserRole(role || 'Admin');
      setUserName(name || 'Admin User');
      setUserId(id || 'unknown');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const setupWebSocket = () => {
    // Listen for new emergencies
    wsService.on('new_emergency', (data: EmergencyReport) => {
      setReports(prev => [data, ...prev]);
      showNotification('🚨 New Emergency', `${data.type} reported`, data.priority === 'Critical');
      
      // Play sound for critical incidents
      if (data.priority === 'Critical') {
        playAlertSound();
      }
    });

    // Listen for AI analysis updates
    wsService.on('ai_analysis_update', (data) => {
      setReports(prev =>
        prev.map(report =>
          report.id === data.reportId
            ? { ...report, aiAnalysis: data.analysis }
            : report
        )
      );
    });

    // Listen for new live streams
    wsService.on('stream_started', (data: LiveStream) => {
      setLiveStreams(prev => [data, ...prev]);
      showNotification('📹 Live Stream Started', `Camera at ${data.location}`, false);
    });

    // Listen for responder status updates
    wsService.on('responder_status_update', (data: Responder) => {
      setResponders(prev =>
        prev.map(r => r.id === data.id ? { ...r, ...data } : r)
      );
    });

    // Listen for report updates
    wsService.on('report_updated', (data: EmergencyReport) => {
      setReports(prev =>
        prev.map(report => report.id === data.id ? data : report)
      );
    });

    // Connection status
    wsService.on('connect', () => {
      console.log('WebSocket connected');
    });

    wsService.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
  };

  const loadMockData = () => {
    // Mock responders
    const mockResponders: Responder[] = [
      {
        id: 'resp_001',
        name: 'Officer Tesfaye',
        type: 'police',
        status: 'available',
        location: { lat: 9.0300, lng: 38.7400 },
      },
      {
        id: 'resp_002',
        name: 'Fire Team A',
        type: 'fire',
        status: 'busy',
        location: { lat: 9.0350, lng: 38.7500 },
        currentIncident: 'Fire at Piassa',
      },
      {
        id: 'resp_003',
        name: 'Medic Sarah',
        type: 'medical',
        status: 'available',
        location: { lat: 9.0250, lng: 38.7350 },
      },
      {
        id: 'resp_004',
        name: 'Officer Solomon',
        type: 'police',
        status: 'offline',
      },
    ];

    // Mock reports
    const mockReports: EmergencyReport[] = [
      {
        id: 'rep_001',
        type: 'Car Accident',
        severity: 'High',
        priority: 'Critical',
        location: { 
          lat: 9.0300, 
          lng: 38.7400,
          address: 'Bole Road, near Airport'
        },
        mediaType: 'video',
        isGuest: false,
        userName: 'Abebe Kebede',
        userPhone: '+251 912 345 678',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        aiAnalysis: {
          type: 'Car Accident',
          confidence: 0.94,
          severity: 'High',
          priority: 'Critical',
          description: 'Multi-vehicle collision detected with possible injuries',
          objects: [
            { class: 'car', confidence: 0.98 },
            { class: 'person', confidence: 0.89 },
            { class: 'ambulance', confidence: 0.76 }
          ]
        },
        status: 'pending',
      },
      {
        id: 'rep_002',
        type: 'Fire',
        severity: 'High',
        priority: 'Critical',
        location: { 
          lat: 9.0350, 
          lng: 38.7500,
          address: 'Piassa Market, Building 4'
        },
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1582139329536-e7282fece6f8',
        isGuest: true,
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        aiAnalysis: {
          type: 'Fire',
          confidence: 0.91,
          severity: 'High',
          priority: 'Critical',
          description: 'Large fire detected, spreading rapidly',
          objects: [
            { class: 'fire', confidence: 0.95 },
            { class: 'smoke', confidence: 0.92 },
            { class: 'person', confidence: 0.68 }
          ]
        },
        status: 'assigned',
        assignedResponder: {
          id: 'resp_002',
          name: 'Fire Team A',
          type: 'fire',
          assignedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
        responderNotes: [
          'En route to location',
          'Estimated arrival in 5 minutes'
        ],
        responseTime: 3,
      },
      {
        id: 'rep_003',
        type: 'Medical Emergency',
        severity: 'Medium',
        priority: 'High',
        location: { 
          lat: 9.0400, 
          lng: 38.7450,
          address: 'Merkato, Gate A'
        },
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1584515933487-779824039510',
        isGuest: false,
        userName: 'Sarah T.',
        userPhone: '+251 923 456 789',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        aiAnalysis: {
          type: 'Medical Emergency',
          confidence: 0.85,
          severity: 'Medium',
          priority: 'High',
          description: 'Person collapsed, possible medical emergency',
          objects: [
            { class: 'person', confidence: 0.95 },
            { class: 'medical', confidence: 0.82 }
          ]
        },
        status: 'resolved',
        assignedResponder: {
          id: 'resp_003',
          name: 'Medic Sarah',
          type: 'medical',
          assignedAt: new Date(Date.now() - 35 * 60000).toISOString(),
        },
        responderNotes: [
          'Patient conscious and stable',
          'Transporting to hospital'
        ],
        responseTime: 12,
      },
      {
        id: 'rep_004',
        type: 'Fighting',
        severity: 'High',
        priority: 'High',
        location: { 
          lat: 9.0380, 
          lng: 38.7520,
          address: 'Mexico Square, Bus Stop'
        },
        mediaType: 'video',
        isGuest: true,
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        aiAnalysis: {
          type: 'Fighting',
          confidence: 0.88,
          severity: 'High',
          priority: 'High',
          description: 'Physical altercation involving multiple people',
          objects: [
            { class: 'person', confidence: 0.96 },
            { class: 'fight', confidence: 0.88 }
          ]
        },
        status: 'pending',
      },
    ];

    // Mock live streams
    const mockStreams: LiveStream[] = [
      {
        id: 'stream_001',
        streamId: 'live_001',
        feedId: 'cam_001',
        location: 'Bole Road',
        startedAt: new Date(Date.now() - 2 * 60000).toISOString(),
        viewerCount: 5,
        status: 'active',
        thumbnail: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f',
        aiAnalysis: {
          type: 'Traffic Accident',
          confidence: 0.76,
          severity: 'Medium',
          priority: 'High',
        }
      },
      {
        id: 'stream_002',
        streamId: 'live_002',
        feedId: 'cam_002',
        location: 'Piassa',
        startedAt: new Date(Date.now() - 8 * 60000).toISOString(),
        viewerCount: 12,
        status: 'active',
        thumbnail: 'https://images.unsplash.com/photo-1576495199011-eb94736d05d6',
        aiAnalysis: {
          type: 'Fire',
          confidence: 0.89,
          severity: 'High',
          priority: 'Critical',
        }
      },
    ];

    setReports(mockReports);
    setLiveStreams(mockStreams);
    setResponders(mockResponders);
    setLoading(false);
  };

  const startAutoRefresh = () => {
    intervalRef.current = setInterval(() => {
      refreshData();
    }, 30000); // Refresh every 30 seconds
  };

  const refreshData = async () => {
    // Simulate data refresh
    console.log('Refreshing data...');
    // In real app, fetch new data from API
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    loadMockData();
    setRefreshing(false);
  };

  const updateStats = () => {
    const active = reports.filter(r => r.status !== 'resolved').length;
    const resolvedToday = reports.filter(r => {
      const reportDate = new Date(r.timestamp).toDateString();
      const today = new Date().toDateString();
      return r.status === 'resolved' && reportDate === today;
    }).length;

    const totalResponseTime = reports
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0);
    const avgTime = reports.filter(r => r.responseTime).length
      ? totalResponseTime / reports.filter(r => r.responseTime).length
      : 0;

    setStats({
      totalIncidents: reports.length,
      activeIncidents: active,
      resolvedToday,
      avgResponseTime: Math.round(avgTime * 10) / 10,
      activeResponders: responders.filter(r => r.status === 'available').length,
      criticalIncidents: reports.filter(r => r.priority === 'Critical' && r.status !== 'resolved').length,
    });
  };

  const showNotification = (title: string, message: string, critical: boolean) => {
    // In a real app, this would show a push notification
    Alert.alert(
      critical ? '🚨 CRITICAL ALERT' : title,
      message,
      [{ text: 'OK' }]
    );
  };

  const playAlertSound = () => {
    // In a real app, play a sound
    console.log('🔊 Playing alert sound');
  };

  const assignResponder = (reportId: string, responderId: string) => {
    const responder = responders.find(r => r.id === responderId);
    if (!responder) return;

    setReports(prev =>
      prev.map(report =>
        report.id === reportId
          ? {
              ...report,
              status: 'assigned',
              assignedResponder: {
                id: responder.id,
                name: responder.name,
                type: responder.type,
                assignedAt: new Date().toISOString(),
              },
              responderNotes: ['Responder assigned'],
            }
          : report
      )
    );

    setResponders(prev =>
      prev.map(r =>
        r.id === responderId
          ? { ...r, status: 'busy', currentIncident: reportId }
          : r
      )
    );

    wsService.emit('responder_assigned', {
      reportId,
      responderId,
      assignedAt: new Date().toISOString(),
    });

    setAssignModalVisible(false);
    Alert.alert('Success', `Assigned ${responder.name} to incident`);
  };

  const addResponderNote = (reportId: string, note: string) => {
    if (!note.trim()) return;

    setReports(prev =>
      prev.map(report =>
        report.id === reportId
          ? {
              ...report,
              responderNotes: [...(report.responderNotes || []), note],
            }
          : report
      )
    );

    setResponderNotes('');
    setNotesModalVisible(false);
    
    wsService.emit('responder_note', {
      reportId,
      note,
      timestamp: new Date().toISOString(),
    });
  };

  const resolveReport = (reportId: string) => {
    Alert.alert(
      'Resolve Incident',
      'Mark this incident as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: () => {
            setReports(prev =>
              prev.map(report =>
                report.id === reportId
                  ? { ...report, status: 'resolved' }
                  : report
              )
            );

            // Free up responder
            const report = reports.find(r => r.id === reportId);
            if (report?.assignedResponder) {
              setResponders(prev =>
                prev.map(r =>
                  r.id === report.assignedResponder?.id
                    ? { ...r, status: 'available', currentIncident: undefined }
                    : r
                )
              );
            }

            wsService.emit('report_resolved', {
              reportId,
              resolvedAt: new Date().toISOString(),
            });

            Alert.alert('Success', 'Incident marked as resolved');
          },
        },
      ]
    );
  };

  const rejectReport = (reportId: string) => {
    Alert.alert(
      'Reject Report',
      'Are you sure this is a false alarm?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: () => {
            setReports(prev =>
              prev.map(report =>
                report.id === reportId
                  ? { ...report, status: 'rejected' }
                  : report
              )
            );
            Alert.alert('Success', 'Report rejected');
          },
        },
      ]
    );
  };

  const viewLiveStream = (stream: LiveStream) => {
    Alert.alert(
      'Live Stream',
      `Viewing stream from ${stream.location}\nAI Analysis: ${stream.aiAnalysis?.type || 'Analyzing...'}`,
      [
        { text: 'Close' },
        { text: 'Assign Responder', onPress: () => handleAssignFromStream(stream) },
      ]
    );
  };

  const handleAssignFromStream = (stream: LiveStream) => {
    // Create a report from stream if needed
    const newReport: EmergencyReport = {
      id: `stream_rep_${Date.now()}`,
      type: stream.aiAnalysis?.type || 'Unknown',
      severity: stream.aiAnalysis?.severity || 'Medium',
      priority: stream.aiAnalysis?.priority || 'Normal',
      location: { lat: 0, lng: 0, address: stream.location },
      mediaType: 'video',
      isGuest: true,
      timestamp: new Date().toISOString(),
      aiAnalysis: stream.aiAnalysis || {
        type: 'Unknown',
        confidence: 0,
        severity: 'Medium',
        priority: 'Normal',
      },
      status: 'pending',
    };
    
    setReports(prev => [newReport, ...prev]);
    setSelectedReport(newReport);
    setAssignModalVisible(true);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await storage.clear();
              wsService.disconnect();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const getFilteredReports = () => {
    let filtered = reports;

    // Filter by status tab
    if (selectedTab === 'pending') {
      filtered = filtered.filter(r => r.status === 'pending');
    } else if (selectedTab === 'assigned') {
      filtered = filtered.filter(r => r.status === 'assigned');
    } else if (selectedTab === 'history') {
      filtered = filtered.filter(r => r.status === 'resolved' || r.status === 'rejected');
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(r => r.priority === filterPriority);
    }

    // Search
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return '#E63939';
      case 'High': return '#FB923C';
      case 'Normal': return '#4ADE80';
      default: return '#94a3b8';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'High': return '🔴';
      case 'Medium': return '🟠';
      case 'Low': return '🟢';
      default: return '⚪';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#FB923C', text: 'Pending' };
      case 'assigned':
        return { color: '#3B82F6', text: 'Assigned' };
      case 'resolved':
        return { color: '#4ADE80', text: 'Resolved' };
      case 'rejected':
        return { color: '#94a3b8', text: 'Rejected' };
      default:
        return { color: '#94a3b8', text: status };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const renderStatCard = (title: string, value: number | string, icon: string, color: string) => (
    <LinearGradient
      colors={[color, color + '80']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statCard}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </LinearGradient>
  );

  const renderReportItem = ({ item }: { item: EmergencyReport }) => {
    const statusBadge = getStatusBadge(item.status);
    
    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => {
          setSelectedReport(item);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#1E3A5F', '#0A2540']}
          style={styles.reportGradient}
        >
          {/* Header */}
          <View style={styles.reportHeader}>
            <View style={styles.reportTitleContainer}>
              <Text style={styles.reportType}>🚨 {item.type}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
            </View>
            <Text style={styles.reportTime}>{formatTime(item.timestamp)}</Text>
          </View>

          {/* Location */}
          <View style={styles.locationContainer}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location.address || `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`}
            </Text>
          </View>

          {/* AI Analysis */}
          <View style={styles.aiContainer}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>AI Analysis</Text>
              <Text style={[styles.aiConfidence, { 
                color: item.aiAnalysis.confidence > 0.8 ? '#4ADE80' : 
                       item.aiAnalysis.confidence > 0.6 ? '#FB923C' : '#94a3b8'
              }]}>
                {Math.round(item.aiAnalysis.confidence * 100)}% confidence
              </Text>
            </View>
            <Text style={styles.aiDescription}>{item.aiAnalysis.description}</Text>
            
            {/* Detected Objects */}
            {item.aiAnalysis.objects && item.aiAnalysis.objects.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.objectsScroll}>
                {item.aiAnalysis.objects.map((obj, index) => (
                  <View key={index} style={styles.objectChip}>
                    <Text style={styles.objectText}>
                      {obj.class} ({Math.round(obj.confidence * 100)}%)
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Reporter Info */}
          <View style={styles.reporterContainer}>
            <Text style={styles.reporterIcon}>👤</Text>
            <Text style={styles.reporterText}>
              {item.isGuest ? 'Guest User' : item.userName || 'Unknown'}
            </Text>
            {item.userPhone && (
              <Text style={styles.reporterPhone}>{item.userPhone}</Text>
            )}
            <View style={[styles.mediaBadge, { 
              backgroundColor: item.mediaType === 'video' ? '#E63939' : '#3B82F6' 
            }]}>
              <Text style={styles.mediaText}>
                {item.mediaType === 'video' ? '📹 Live' : '📸 Photo'}
              </Text>
            </View>
          </View>

          {/* Assigned Responder */}
          {item.assignedResponder && (
            <View style={styles.assignedContainer}>
              <Text style={styles.assignedIcon}>👮</Text>
              <Text style={styles.assignedText}>
                {item.assignedResponder.name} ({item.assignedResponder.type})
              </Text>
              <Text style={styles.assignedTime}>
                {formatTime(item.assignedResponder.assignedAt)}
              </Text>
            </View>
          )}

          {/* Responder Notes */}
          {item.responderNotes && item.responderNotes.length > 0 && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesIcon}>📝</Text>
              <Text style={styles.notesText} numberOfLines={1}>
                Latest: {item.responderNotes[item.responderNotes.length - 1]}
              </Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.reportFooter}>
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
              <Text style={styles.statusText}>{statusBadge.text}</Text>
            </View>
            {item.responseTime && (
              <Text style={styles.responseTime}>⏱️ {item.responseTime} min response</Text>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderLiveStreamItem = ({ item }: { item: LiveStream }) => (
    <TouchableOpacity
      style={styles.streamCard}
      onPress={() => viewLiveStream(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.thumbnail }} style={styles.streamImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.streamOverlay}
      >
        <View style={styles.streamHeader}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={styles.viewerBadge}>
            <Text style={styles.viewerText}>👁️ {item.viewerCount}</Text>
          </View>
        </View>

        <Text style={styles.streamLocation}>{item.location}</Text>
        
        {item.aiAnalysis && (
          <View style={styles.streamAnalysis}>
            <Text style={styles.streamAnalysisType}>
              {getSeverityIcon(item.aiAnalysis.severity)} {item.aiAnalysis.type}
            </Text>
            <Text style={styles.streamAnalysisConf}>
              {Math.round(item.aiAnalysis.confidence * 100)}% confidence
            </Text>
          </View>
        )}

        <Text style={styles.streamTime}>Started {formatTime(item.startedAt)}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderResponderItem = ({ item }: { item: Responder }) => {
    const statusColors = {
      available: '#4ADE80',
      busy: '#FB923C',
      offline: '#94a3b8',
    };

    return (
      <View style={styles.responderCard}>
        <View style={styles.responderHeader}>
          <View style={styles.responderInfo}>
            <Text style={styles.responderName}>{item.name}</Text>
            <View style={[styles.responderTypeBadge, {
              backgroundColor: item.type === 'police' ? '#3B82F6' :
                              item.type === 'fire' ? '#E63939' : '#4ADE80'
            }]}>
              <Text style={styles.responderTypeText}>{item.type}</Text>
            </View>
          </View>
          <View style={[styles.responderStatus, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.responderStatusText}>{item.status}</Text>
          </View>
        </View>

        {item.location && (
          <Text style={styles.responderLocation}>
            📍 {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
          </Text>
        )}

        {item.currentIncident && (
          <Text style={styles.responderIncident}>
            🚨 Currently at: {item.currentIncident}
          </Text>
        )}
      </View>
    );
  };

  const renderReportModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <BlurView intensity={90} style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {selectedReport && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Incident Details</Text>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Basic Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Incident Information</Text>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Type:</Text>
                    <Text style={styles.modalInfoValue}>{selectedReport.type}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Priority:</Text>
                    <View style={[styles.modalPriorityBadge, { 
                      backgroundColor: getPriorityColor(selectedReport.priority) 
                    }]}>
                      <Text style={styles.modalPriorityText}>{selectedReport.priority}</Text>
                    </View>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Status:</Text>
                    <View style={[styles.modalStatusBadge, { 
                      backgroundColor: getStatusBadge(selectedReport.status).color 
                    }]}>
                      <Text style={styles.modalStatusText}>{selectedReport.status}</Text>
                    </View>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Location</Text>
                  <Text style={styles.modalAddress}>
                    {selectedReport.location.address || 'Address not available'}
                  </Text>
                  <Text style={styles.modalCoordinates}>
                    Lat: {selectedReport.location.lat.toFixed(6)}, Lng: {selectedReport.location.lng.toFixed(6)}
                  </Text>
                </View>

                {/* AI Analysis */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>AI Analysis</Text>
                  <View style={styles.modalAiContainer}>
                    <Text style={styles.modalAiType}>{selectedReport.aiAnalysis.type}</Text>
                    <Text style={[styles.modalAiConfidence, { 
                      color: selectedReport.aiAnalysis.confidence > 0.8 ? '#4ADE80' : '#FB923C'
                    }]}>
                      Confidence: {Math.round(selectedReport.aiAnalysis.confidence * 100)}%
                    </Text>
                    <Text style={styles.modalAiDescription}>
                      {selectedReport.aiAnalysis.description}
                    </Text>
                    
                    {selectedReport.aiAnalysis.objects && (
                      <View style={styles.modalObjects}>
                        <Text style={styles.modalObjectsTitle}>Detected Objects:</Text>
                        {selectedReport.aiAnalysis.objects.map((obj, index) => (
                          <Text key={index} style={styles.modalObject}>
                            • {obj.class}: {Math.round(obj.confidence * 100)}% confidence
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Reporter Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Reporter</Text>
                  <Text style={styles.modalReporter}>
                    {selectedReport.isGuest ? 'Guest User' : selectedReport.userName || 'Anonymous'}
                  </Text>
                  {selectedReport.userPhone && (
                    <Text style={styles.modalReporterPhone}>📞 {selectedReport.userPhone}</Text>
                  )}
                </View>

                {/* Timeline */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Timeline</Text>
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineTime}>Reported:</Text>
                    <Text style={styles.timelineText}>
                      {new Date(selectedReport.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  {selectedReport.assignedResponder && (
                    <View style={styles.timelineItem}>
                      <Text style={styles.timelineTime}>Assigned:</Text>
                      <Text style={styles.timelineText}>
                        {new Date(selectedReport.assignedResponder.assignedAt).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {selectedReport.responseTime && (
                    <View style={styles.timelineItem}>
                      <Text style={styles.timelineTime}>Response Time:</Text>
                      <Text style={styles.timelineText}>{selectedReport.responseTime} minutes</Text>
                    </View>
                  )}
                </View>

                {/* Responder Notes */}
                {selectedReport.responderNotes && selectedReport.responderNotes.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Responder Notes</Text>
                    {selectedReport.responderNotes.map((note, index) => (
                      <View key={index} style={styles.noteItem}>
                        <Text style={styles.noteText}>• {note}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalFooter}>
                {selectedReport.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.assignButton]}
                      onPress={() => {
                        setModalVisible(false);
                        setAssignModalVisible(true);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Assign Responder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.rejectButton]}
                      onPress={() => {
                        setModalVisible(false);
                        rejectReport(selectedReport.id);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedReport.status === 'assigned' && (
                  <>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.noteButton]}
                      onPress={() => {
                        setModalVisible(false);
                        setNotesModalVisible(true);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Add Note</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.resolveButton]}
                      onPress={() => {
                        setModalVisible(false);
                        resolveReport(selectedReport.id);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Resolve</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.modalButton, styles.closeModalButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </BlurView>
    </Modal>
  );

  const renderAssignModal = () => (
    <Modal
      visible={assignModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setAssignModalVisible(false)}
    >
      <BlurView intensity={90} style={styles.modalContainer}>
        <View style={styles.assignModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Responder</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setAssignModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.assignModalBody}>
            {responders
              .filter(r => r.status === 'available')
              .map(responder => (
                <TouchableOpacity
                  key={responder.id}
                  style={styles.assignItem}
                  onPress={() => assignResponder(selectedReport?.id || '', responder.id)}
                >
                  <View style={styles.assignItemHeader}>
                    <Text style={styles.assignItemName}>{responder.name}</Text>
                    <View style={[styles.responderTypeBadge, {
                      backgroundColor: responder.type === 'police' ? '#3B82F6' :
                                      responder.type === 'fire' ? '#E63939' : '#4ADE80'
                    }]}>
                      <Text style={styles.responderTypeText}>{responder.type}</Text>
                    </View>
                  </View>
                  {responder.location && (
                    <Text style={styles.assignItemLocation}>
                      📍 {responder.location.lat.toFixed(4)}, {responder.location.lng.toFixed(4)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            
            {responders.filter(r => r.status === 'available').length === 0 && (
              <Text style={styles.noRespondersText}>No available responders at the moment</Text>
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );

  const renderNotesModal = () => (
    <Modal
      visible={notesModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setNotesModalVisible(false)}
    >
      <BlurView intensity={90} style={styles.modalContainer}>
        <View style={styles.notesModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Responder Note</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setNotesModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notesModalBody}>
            <TextInput
              style={styles.notesInput}
              placeholder="Enter note..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={responderNotes}
              onChangeText={setResponderNotes}
            />

            <TouchableOpacity
              style={[styles.saveNoteButton, !responderNotes.trim() && styles.saveNoteButtonDisabled]}
              onPress={() => addResponderNote(selectedReport?.id || '', responderNotes)}
              disabled={!responderNotes.trim()}
            >
              <Text style={styles.saveNoteButtonText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E63939" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0A2540', '#1E3A5F']}
        style={styles.header}
      >
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.userName}>{userName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{userRole}</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.statsScroll}
        contentContainerStyle={styles.statsContent}
      >
        {renderStatCard('Total', stats.totalIncidents, '📊', '#3B82F6')}
        {renderStatCard('Active', stats.activeIncidents, '🔴', '#E63939')}
        {renderStatCard('Critical', stats.criticalIncidents, '🚨', '#FF6B6B')}
        {renderStatCard('Resolved Today', stats.resolvedToday, '✅', '#4ADE80')}
        {renderStatCard('Responders', stats.activeResponders, '👮', '#FB923C')}
        {renderStatCard('Avg Response', `${stats.avgResponseTime}m`, '⏱️', '#A78BFA')}
      </ScrollView>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search incidents..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterChip, filterPriority === 'all' && styles.filterChipActive]}
            onPress={() => setFilterPriority('all')}
          >
            <Text style={[styles.filterChipText, filterPriority === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterPriority === 'Critical' && styles.filterChipActive]}
            onPress={() => setFilterPriority('Critical')}
          >
            <Text style={[styles.filterChipText, filterPriority === 'Critical' && styles.filterChipTextActive]}>
              Critical
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterPriority === 'High' && styles.filterChipActive]}
            onPress={() => setFilterPriority('High')}
          >
            <Text style={[styles.filterChipText, filterPriority === 'High' && styles.filterChipTextActive]}>
              High
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'live' && styles.activeTab]}
          onPress={() => setSelectedTab('live')}
        >
          <Text style={[styles.tabText, selectedTab === 'live' && styles.activeTabText]}>
            📹 Live ({liveStreams.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'pending' && styles.activeTab]}
          onPress={() => setSelectedTab('pending')}
        >
          <Text style={[styles.tabText, selectedTab === 'pending' && styles.activeTabText]}>
            ⏳ Pending ({reports.filter(r => r.status === 'pending').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'assigned' && styles.activeTab]}
          onPress={() => setSelectedTab('assigned')}
        >
          <Text style={[styles.tabText, selectedTab === 'assigned' && styles.activeTabText]}>
            👮 Assigned ({reports.filter(r => r.status === 'assigned').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'history' && styles.activeTab]}
          onPress={() => setSelectedTab('history')}
        >
          <Text style={[styles.tabText, selectedTab === 'history' && styles.activeTabText]}>
            📋 History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'responders' && styles.activeTab]}
          onPress={() => setSelectedTab('responders')}
        >
          <Text style={[styles.tabText, selectedTab === 'responders' && styles.activeTabText]}>
            👥 Responders
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedTab === 'live' && (
        <FlatList
          data={liveStreams}
          renderItem={renderLiveStreamItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.streamsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No live streams at the moment</Text>
            </View>
          }
        />
      )}

      {selectedTab === 'responders' && (
        <FlatList
          data={responders}
          renderItem={renderResponderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.respondersList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No responders available</Text>
            </View>
          }
        />
      )}

      {(selectedTab === 'pending' || selectedTab === 'assigned' || selectedTab === 'history') && (
        <FlatList
          data={getFilteredReports()}
          renderItem={renderReportItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.reportsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reports found</Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      {renderReportModal()}
      {renderAssignModal()}
      {renderNotesModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A2540',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  welcome: {
    color: '#94a3b8',
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: '#ffcc00',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  refreshButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
  },
  logoutButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 24,
  },
  statsScroll: {
    maxHeight: 120,
    marginBottom: 15,
  },
  statsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    width: 120,
    height: 100,
    borderRadius: 16,
    padding: 15,
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E3A5F',
  },
  filterChipActive: {
    backgroundColor: '#E63939',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E3A5F',
  },
  activeTab: {
    backgroundColor: '#E63939',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  streamsList: {
    paddingHorizontal: 20,
    gap: 15,
  },
  streamCard: {
    width: width * 0.7,
    height: 200,
    marginRight: 15,
    borderRadius: 16,
    overflow: 'hidden',
  },
  streamImage: {
    width: '100%',
    height: '100%',
  },
  streamOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E63939',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewerBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerText: {
    color: '#fff',
    fontSize: 10,
  },
  streamLocation: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streamAnalysis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  streamAnalysisType: {
    color: '#ffcc00',
    fontSize: 13,
    fontWeight: '600',
  },
  streamAnalysisConf: {
    color: '#94a3b8',
    fontSize: 11,
  },
  streamTime: {
    color: '#94a3b8',
    fontSize: 11,
  },
  reportsList: {
    padding: 20,
  },
  reportCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  reportGradient: {
    padding: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reportType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reportTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 8,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  locationText: {
    color: '#ffcc00',
    fontSize: 13,
    flex: 1,
  },
  aiContainer: {
    backgroundColor: 'rgba(255,204,0,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  aiTitle: {
    color: '#ffcc00',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  aiConfidence: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiDescription: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 8,
  },
  objectsScroll: {
    flexDirection: 'row',
  },
  objectChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  objectText: {
    color: '#fff',
    fontSize: 11,
  },
  reporterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  reporterIcon: {
    fontSize: 14,
  },
  reporterText: {
    color: '#fff',
    fontSize: 13,
  },
  reporterPhone: {
    color: '#94a3b8',
    fontSize: 12,
  },
  mediaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  mediaText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  assignedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  assignedIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  assignedText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  assignedTime: {
    color: '#94a3b8',
    fontSize: 11,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  notesIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  notesText: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  responseTime: {
    color: '#94a3b8',
    fontSize: 11,
  },
  respondersList: {
    padding: 20,
  },
  responderCard: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  responderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  responderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  responderName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  responderTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  responderTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  responderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  responderStatusText: {
    color: '#0A2540',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  responderLocation: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  responderIncident: {
    color: '#ffcc00',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    overflow: 'hidden',
  },
  assignModalContent: {
    width: width * 0.9,
    maxHeight: height * 0.6,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    overflow: 'hidden',
  },
  notesModalContent: {
    width: width * 0.9,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D4A6F',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    padding: 5,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 20,
  },
  modalBody: {
    padding: 20,
  },
  assignModalBody: {
    padding: 20,
  },
  notesModalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    color: '#ffcc00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalInfoLabel: {
    color: '#94a3b8',
    fontSize: 14,
    width: 80,
  },
  modalInfoValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  modalPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalPriorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalAddress: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  modalCoordinates: {
    color: '#94a3b8',
    fontSize: 12,
  },
  modalAiContainer: {
    backgroundColor: 'rgba(255,204,0,0.1)',
    padding: 12,
    borderRadius: 8,
  },
  modalAiType: {
    color: '#ffcc00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalAiConfidence: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalAiDescription: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  modalObjects: {
    marginTop: 8,
  },
  modalObjectsTitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  modalObject: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 2,
  },
  modalReporter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalReporterPhone: {
    color: '#94a3b8',
    fontSize: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  timelineTime: {
    color: '#94a3b8',
    fontSize: 13,
    width: 90,
  },
  timelineText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  noteItem: {
    marginBottom: 6,
  },
  noteText: {
    color: '#fff',
    fontSize: 13,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2D4A6F',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButton: {
    backgroundColor: '#3B82F6',
  },
  rejectButton: {
    backgroundColor: '#94a3b8',
  },
  noteButton: {
    backgroundColor: '#FB923C',
  },
  resolveButton: {
    backgroundColor: '#4ADE80',
  },
  closeModalButton: {
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#2D4A6F',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  assignItem: {
    backgroundColor: '#0A2540',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  assignItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  assignItemLocation: {
    color: '#94a3b8',
    fontSize: 12,
  },
  noRespondersText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  notesInput: {
    backgroundColor: '#0A2540',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  saveNoteButton: {
    backgroundColor: '#4ADE80',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveNoteButtonDisabled: {
    opacity: 0.5,
  },
  saveNoteButtonText: {
    color: '#0A2540',
    fontSize: 16,
    fontWeight: 'bold',
  },
});