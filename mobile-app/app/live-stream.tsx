import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Platform, AppState
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import * as ImageManipulator from 'expo-image-manipulator';

const { width, height } = Dimensions.get('window');

// Try multiple connection options
const SERVER_IPS = [
  'http://192.168.137.1:5000',  // Your local IP
  'http://192.168.1.100:5000',  // Common local IP
  'http://10.0.2.2:5000',       // Android emulator localhost
  'http://localhost:5000',       // Localhost (iOS simulator)
];

export default function LiveStreamScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [location, setLocation] = useState<any>(null);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [socketUrl, setSocketUrl] = useState<string>(SERVER_IPS[0]);
  
  const cameraRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const frameInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionAttempts = useRef(0);
  
  const router = useRouter();

  useEffect(() => {
    getLocation();
    connectToServer();
    
    // Listen for app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (isStreaming) stopStreaming();
      if (socketRef.current) socketRef.current.disconnect();
      if (durationTimer.current) clearInterval(durationTimer.current);
      if (frameInterval.current) clearInterval(frameInterval.current);
    };
  }, []);

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active' && !socketRef.current?.connected && !isStreaming) {
      // Reconnect when app comes to foreground
      connectToServer();
    } else if (nextAppState === 'background' && isStreaming) {
      // Optionally pause streaming when in background
      console.log('App in background, continuing stream...');
    }
  };

  const connectToServer = async (ipIndex = 0) => {
    if (ipIndex >= SERVER_IPS.length) {
      console.error('Failed to connect to any server');
      setConnectionStatus('disconnected');
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please check your network connection and server status.',
        [
          { text: 'Retry', onPress: () => connectToServer(0) },
          { text: 'Go Back', onPress: () => router.back() }
        ]
      );
      return;
    }

    const url = SERVER_IPS[ipIndex];
    setSocketUrl(url);
    setConnectionStatus('connecting');
    
    console.log(`Attempting to connect to: ${url}`);
    
    try {
      // First, test if the server is reachable via HTTP
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal
      }).catch(() => null);
      
      clearTimeout(timeoutId);
      
      if (!response || !response.ok) {
        console.log(`Server ${url} not reachable, trying next...`);
        connectToServer(ipIndex + 1);
        return;
      }
      
      console.log(`✅ Server reachable at ${url}`);
      
      // Connect Socket.IO
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 10000,
        forceNew: true
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected to:', url);
        setConnectionStatus('connected');
        connectionAttempts.current = 0;
        
        // If we were streaming, restart the stream
        if (isStreaming && streamId) {
          restartStream();
        }
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error.message);
        setConnectionStatus('disconnected');
        
        if (connectionAttempts.current < 3) {
          connectionAttempts.current++;
          setTimeout(() => connectToServer(ipIndex), 2000);
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setConnectionStatus('disconnected');
        
        if (isStreaming && reason !== 'io client disconnect') {
          // Try to reconnect if we were streaming
          setTimeout(() => connectToServer(ipIndex), 3000);
        }
      });
      
      socket.on('viewer-joined', (data: any) => {
        setViewerCount(data.viewerCount);
        console.log(`👁️ New viewer joined, total: ${data.viewerCount}`);
      });
      
      socket.on('viewer-left', (data: any) => {
        setViewerCount(data.viewerCount);
        console.log(`👋 Viewer left, total: ${data.viewerCount}`);
      });
      
      socket.on('stream-error', (data: any) => {
        console.error('Stream error:', data.error);
        Alert.alert('Stream Error', data.error);
        if (isStreaming) stopStreaming();
      });
      
      socketRef.current = socket;
      
    } catch (error) {
      console.error(`Failed to connect to ${url}:`, error);
      connectToServer(ipIndex + 1);
    }
  };

  const restartStream = async () => {
    if (!socketRef.current?.connected || !streamId) return;
    
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      socketRef.current.emit('start-stream', {
        streamId: streamId,
        cameraName: user?.fullName ? `${user.fullName}'s Stream` : (isGuest === 'true' ? 'Guest Stream' : 'Mobile Stream'),
        location: location ? `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}` : 'Unknown',
        userId: user?.id
      });
      
      console.log('Stream restarted');
    } catch (error) {
      console.error('Error restarting stream:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        setLocation(loc);
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };
// In live-stream.tsx, update captureAndSendFrame function
const captureAndSendFrame = async () => {
  if (!cameraRef.current || !isStreaming || !socketRef.current?.connected) return;
  
  try {
    console.log('📸 Capturing frame...');
    
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.4,
      base64: true,
      skipProcessing: true,
    });
    
    if (photo && photo.base64) {
      console.log('📸 Frame captured, size:', photo.base64.length);
      
      // Compress image
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.5, base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      if (compressed.base64) {
        console.log('📤 Sending frame, compressed size:', compressed.base64.length);
        
        // Send frame to server
        socketRef.current.emit('stream-frame', {
          streamId,
          frame: compressed.base64,
          timestamp: Date.now()
        });
        
        // Add this to verify frame was sent
        console.log('✅ Frame sent successfully at:', new Date().toISOString());
      }
    }
  } catch (error) {
    console.error('❌ Error capturing frame:', error);
  }
};

  const startStreaming = async () => {
    if (!permission?.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for streaming');
        return;
      }
    }
    
    if (connectionStatus !== 'connected') {
      Alert.alert(
        'Not Connected',
        'Please wait for connection to server or check your network.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generate unique stream ID
      const newStreamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setStreamId(newStreamId);
      
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      // Start stream on signaling server
      socketRef.current.emit('start-stream', {
        streamId: newStreamId,
        cameraName: user?.fullName ? `${user.fullName}'s Stream` : (isGuest === 'true' ? 'Guest Stream' : 'Mobile Stream'),
        location: location ? `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}` : 'Unknown',
        userId: user?.id
      });
      
      setIsStreaming(true);
      setStreamDuration(0);
      setIsRecording(true);
      
      // Start duration timer
      durationTimer.current = setInterval(() => {
        setStreamDuration(prev => prev + 1);
      }, 1000);
      
      // Start frame capture every 1000ms (1 FPS - reduced for better performance)
      frameInterval.current = setInterval(() => {
        captureAndSendFrame();
      }, 1000);
      
      Alert.alert('Stream Started', 'Your live stream is now active. Admin can view it instantly.');
      
    } catch (error) {
      console.error('Error starting stream:', error);
      Alert.alert('Error', 'Failed to start stream. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreaming = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    if (frameInterval.current) {
      clearInterval(frameInterval.current);
      frameInterval.current = null;
    }
    
    if (socketRef.current && socketRef.current.connected && streamId) {
      socketRef.current.emit('stop-stream', streamId);
    }
    
    setIsStreaming(false);
    setIsRecording(false);
    setStreamId(null);
    setViewerCount(0);
    setStreamDuration(0);
    
    Alert.alert('Stream Ended', 'Your live stream has been stopped.');
    router.back();
  };

  const toggleCamera = async () => {
    const newType = cameraType === 'back' ? 'front' : 'back';
    setCameraType(newType);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show connection status while connecting
  if (connectionStatus === 'connecting' && !isStreaming) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E63939" />
          <Text style={styles.connectingText}>Connecting to server...</Text>
          <Text style={styles.connectingSubText}>{socketUrl}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => connectToServer(0)}
          >
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (!permission?.granted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={60} color="#E63939" />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (!isStreaming) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.startContainer}>
          {/* Connection status indicator */}
          <View style={styles.connectionStatus}>
            <View style={[
              styles.connectionDot,
              connectionStatus === 'connected' ? styles.connectedDot : styles.disconnectedDot
            ]} />
            <Text style={styles.connectionText}>
              {connectionStatus === 'connected' ? 'Connected to server' : 'Disconnected from server'}
            </Text>
          </View>
          
          <View style={styles.streamPreview}>
            <View style={styles.previewIcon}>
              <Ionicons name="videocam" size={80} color="#E63939" />
            </View>
            <Text style={styles.previewTitle}>Live Stream</Text>
            <Text style={styles.previewText}>
              Start a live stream to share real-time video with admin
            </Text>
            {location && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={16} color="#94a3b8" />
                <Text style={styles.locationText}>
                  {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.startButton,
              connectionStatus !== 'connected' && styles.disabledButton
            ]} 
            onPress={startStreaming}
            disabled={isLoading || connectionStatus !== 'connected'}
          >
            <LinearGradient 
              colors={connectionStatus === 'connected' ? ['#E63939', '#b91c1c'] : ['#6c6c6c', '#5a5a5a']} 
              style={styles.startGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="radio" size={24} color="#fff" />
                  <Text style={styles.startButtonText}>
                    {connectionStatus === 'connected' ? 'Start Live Stream' : 'Waiting for connection'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType === 'back' ? 'back' : 'front'}
        mode="video"
        videoQuality="480p" // Use lower quality for better performance
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={styles.topOverlay}
        >
          <View style={styles.streamInfo}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.viewerCountContainer}>
              <Ionicons name="eye" size={14} color="#fff" />
              <Text style={styles.viewerCountText}>{viewerCount} watching</Text>
            </View>
            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>{formatDuration(streamDuration)}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.stopButton} onPress={stopStreaming}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
        
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bottomOverlay}
        >
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={stopStreaming}>
              <Ionicons name="call" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.streamingHint}>Live streaming to admin dashboard</Text>
        </LinearGradient>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  startContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  connectionStatus: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20
  },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  connectedDot: { backgroundColor: '#10b981' },
  disconnectedDot: { backgroundColor: '#ef4444' },
  connectionText: { color: '#94a3b8', fontSize: 12 },
  streamPreview: { alignItems: 'center', marginBottom: 40 },
  previewIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(230, 57, 57, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  previewTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  previewText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
  locationInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  locationText: { color: '#94a3b8', fontSize: 12 },
  startButton: { width: width - 80, borderRadius: 30, overflow: 'hidden', marginTop: 20 },
  startGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 20, paddingBottom: 20 },
  streamInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E63939', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  viewerCountContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  viewerCountText: { color: '#fff', fontSize: 12 },
  durationContainer: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  durationText: { color: '#fff', fontSize: 12 },
  stopButton: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 30 },
  recordingIndicator: { position: 'absolute', top: 100, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E63939', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recordingText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40, paddingTop: 20, alignItems: 'center' },
  controls: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  controlButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 40, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  endButton: { backgroundColor: '#E63939' },
  streamingHint: { color: '#94a3b8', fontSize: 12 },
  permissionText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  permissionButton: { backgroundColor: '#E63939', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  connectingText: { color: '#fff', fontSize: 18, marginTop: 20 },
  connectingSubText: { color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' },
  retryButton: { backgroundColor: '#E63939', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});