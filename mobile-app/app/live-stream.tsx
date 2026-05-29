import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Platform, AppState, Animated,
} from 'react-native';
import AppLoader from '../components/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Server connection URLs
const SERVER_IPS = [
  'http://10.161.68.44:5000',
  'http://192.168.1.100:5000',
  'http://10.0.2.2:5000',
  'http://localhost:5000',
];

// ── AI label → color map ──────────────────────────────────────────────────────
const LABEL_COLOR: Record<string, string> = {
  person:       '#facc15',
  car:          '#60a5fa',
  truck:        '#f87171',
  bus:          '#f97316',
  motorcycle:   '#a78bfa',
  bicycle:      '#34d399',
  chair:        '#fb7185',
  table:        '#38bdf8',
  bottle:       '#a3e635',
  phone:        '#e879f9',
  laptop:       '#fbbf24',
  dog:          '#4ade80',
  cat:          '#22d3ee',
  accident:     '#ef4444',
  fire:         '#ef4444',
  default:      '#facc15',
};
const getLabelColor = (label: string) => LABEL_COLOR[label.toLowerCase()] ?? LABEL_COLOR.default;

interface BBox {
  label: string;
  confidence: number;
  x: number; // 0-1 normalised
  y: number;
  w: number;
  h: number;
}

// ── Bounding Box Overlay ──────────────────────────────────────────────────────
const BoundingBoxes = ({ boxes, viewW, viewH }: { boxes: BBox[]; viewW: number; viewH: number }) => {
  if (!boxes.length) return null;
  return (
    <>
      {boxes.map((box, i) => {
        const color = getLabelColor(box.label);
        const px = box.x * viewW;
        const py = box.y * viewH;
        const pw = box.w * viewW;
        const ph = box.h * viewH;
        const conf = Math.round(box.confidence * 100);
        return (
          <View key={i} style={[styles.bbox, { left: px, top: py, width: pw, height: ph, borderColor: color }]}>
            {/* Corner accents */}
            <View style={[styles.corner, styles.cornerTL, { borderColor: color }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: color }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: color }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: color }]} />
            {/* Label chip */}
            <View style={[styles.labelChip, { backgroundColor: color }]}>
              <Text style={styles.labelText}>{box.label.toUpperCase()} {conf}%</Text>
            </View>
          </View>
        );
      })}
    </>
  );
};

export default function LiveStreamScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [location, setLocation] = useState<any>(null);
  const locationRef = useRef<any>(null); // always mirrors latest location to avoid stale closures
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [torchOn, setTorchOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [socketUrl, setSocketUrl] = useState<string>(SERVER_IPS[0]);
  const [frameCount, setFrameCount] = useState(0);

  // AI detection state
  const [aiBoxes, setAiBoxes] = useState<BBox[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiAlert, setAiAlert] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; sub?: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, sub?: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, sub, type });
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToast(null));
    }, 3500);
  };
  const [cameraLayout, setCameraLayout] = useState({ w: width, h: height });
  const aiFrameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAiFrameRef = useRef<number>(0);
  const aiAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const cameraRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionAttempts = useRef(0);
  const streamIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);
  const connectionStatusRef = useRef<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  const router = useRouter();

  const autoStartDoneRef = useRef(false);

  // Keep connectionStatusRef in sync with state
  useEffect(() => { connectionStatusRef.current = connectionStatus; }, [connectionStatus]);

  useEffect(() => {
    getLocation();
    connectToServer();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (isStreamingRef.current) stopStreaming();
      if (socketRef.current) socketRef.current.disconnect();
      if (durationTimer.current) clearInterval(durationTimer.current);
      if (frameInterval.current) clearInterval(frameInterval.current);
    };
  }, []);

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active' && !socketRef.current?.connected && !isStreaming) {
      connectToServer();
    }
  };

  const connectToServer = async (ipIndex = 0) => {
    if (ipIndex >= SERVER_IPS.length) {
      console.error('Failed to connect to any server');
      setConnectionStatus('disconnected');
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please check your network connection.',
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
      
      // Get user token for authentication
      const userDataStr = await AsyncStorage.getItem('userData');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const authToken = userData?.id ? String(userData.id) : null;
      
      if (authToken) {
        console.log(`🔐 Authenticating with user ID: ${authToken}`);
      } else {
        console.log(`🔓 No auth token - will connect as guest`);
      }
      
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 10000,
        forceNew: true,
        auth: {
          token: authToken
        }
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected to:', url);
        connectionStatusRef.current = 'connected';
        setConnectionStatus('connected');
        connectionAttempts.current = 0;
        
        if (isStreamingRef.current && streamIdRef.current) {
          restartStream();
        } else if (!autoStartDoneRef.current) {
          // Auto-start stream immediately on first connection
          autoStartDoneRef.current = true;
          startStreamingDirect();
        }
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error.message);
        connectionStatusRef.current = 'disconnected';
        setConnectionStatus('disconnected');
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        connectionStatusRef.current = 'disconnected';
        setConnectionStatus('disconnected');
      });
      
      socket.on('viewer-joined', (data: any) => {
        setViewerCount(data.viewerCount);
        console.log(`👁️ New viewer joined, total: ${data.viewerCount}`);
      });
      
      socket.on('viewer-left', (data: any) => {
        setViewerCount(data.viewerCount);
        console.log(`👋 Viewer left, total: ${data.viewerCount}`);
      });
      
      socket.on('frame-received', (data: any) => {
        setFrameCount(prev => prev + 1);
      });

      // AI detection results → update bounding boxes
      socket.on('ai-detection', (data: any) => {
        if (!data) return;
        const rawBoxes: BBox[] = Array.isArray(data.detections) ? data.detections : [];
        setAiBoxes(rawBoxes);
        if (data.isAlert && data.decision) {
          setAiAlert(data.decision);
          if (aiAlertTimer.current) clearTimeout(aiAlertTimer.current);
          aiAlertTimer.current = setTimeout(() => setAiAlert(null), 4000);
        }
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
    if (!socketRef.current?.connected || !streamIdRef.current) return;
    
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      const freshLoc = await getFreshLocation();
      socketRef.current.emit('start-stream', {
        streamId: streamIdRef.current,
        cameraName: user?.fullName ? `${user.fullName}'s Stream` : (isGuest === 'true' ? 'Guest Stream' : 'Mobile Stream'),
        location: freshLoc
          ? `${freshLoc.coords.latitude.toFixed(6)}, ${freshLoc.coords.longitude.toFixed(6)}`
          : 'Unknown',
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
          accuracy: Location.Accuracy.High, // use High accuracy for precise coords
        });
        setLocation(loc);
        locationRef.current = loc; // keep ref in sync
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const getFreshLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(loc);
        locationRef.current = loc;
        return loc;
      }
    } catch {}
    return locationRef.current; // fallback to cached
  };

  // ── Capture a frame, send for streaming AND optionally trigger AI detection ─
  const captureAndSendFrame = async (triggerAI = false) => {
    if (!cameraRef.current || !isStreamingRef.current || !socketRef.current?.connected || !streamIdRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.25,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!photo?.base64 || photo.base64.length < 500) return;

      // Stream frame (smaller = faster delivery to dashboard)
      const streamFrame = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 480 } }],
        { compress: 0.45, base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (streamFrame.base64) {
        socketRef.current.emit('stream-frame', {
          streamId: streamIdRef.current,
          frame: streamFrame.base64,
          timestamp: Date.now(),
        });
      }

      // AI detection frame (sent separately every ~2 s, slightly larger for accuracy)
      if (triggerAI && aiEnabled) {
        const aiFrame = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.6, base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );
        if (aiFrame.base64) {
          socketRef.current.emit('ai-analyze-frame', {
            streamId: streamIdRef.current,
            frame: aiFrame.base64,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Frame capture error:', error);
    }
  };

  // Internal version used by auto-start — bypasses state check, uses ref directly
  const startStreamingDirect = async () => {
    if (!permission?.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for streaming');
        return;
      }
    }
    if (!socketRef.current?.connected) {
      Alert.alert('Not Connected', 'Unable to reach server.');
      return;
    }
    await _doStartStream();
  };

  const startStreaming = async () => {
    if (!permission?.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for streaming');
        return;
      }
    }
    
    if (connectionStatusRef.current !== 'connected') {
      Alert.alert('Not Connected', 'Please wait for connection to server.');
      return;
    }
    await _doStartStream();
  };

  const _doStartStream = async () => {
    
    setIsLoading(true);
    
    try {
      const newStreamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setStreamId(newStreamId);
      streamIdRef.current = newStreamId; // Set ref immediately for closure access
      setFrameCount(0);
      
      // Always fetch fresh GPS right before starting stream — avoids stale/null location
      const freshLoc = await getFreshLocation();

      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      socketRef.current.emit('start-stream', {
        streamId: newStreamId,
        cameraName: user?.fullName ? `${user.fullName}'s Stream` : (isGuest === 'true' ? 'Guest Stream' : 'Mobile Stream'),
        location: freshLoc
          ? `${freshLoc.coords.latitude.toFixed(6)}, ${freshLoc.coords.longitude.toFixed(6)}`
          : 'Unknown',
        userId: user?.id
      });
      
      setIsStreaming(true);
      isStreamingRef.current = true; // Set ref immediately for closure access
      setStreamDuration(0);
      setIsRecording(true);
      
      durationTimer.current = setInterval(() => {
        setStreamDuration(prev => prev + 1);
      }, 1000);
      
      // Stream frames every 800 ms (~1.2 fps) — smooth delivery
      let tick = 0;
      frameInterval.current = setInterval(() => {
        tick++;
        // Every 3rd tick (~every 2.4 s) also trigger AI analysis
        captureAndSendFrame(tick % 3 === 0);
      }, 800);
      
      showToast('Stream Started', 'Your live stream is now active. Admin can view it.', 'success');
      
    } catch (error) {
      console.error('Error starting stream:', error);
      Alert.alert('Error', 'Failed to start stream. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreaming = () => {
    if (durationTimer.current) { clearInterval(durationTimer.current); durationTimer.current = null; }
    if (frameInterval.current) { clearInterval(frameInterval.current); frameInterval.current = null; }
    if (aiAlertTimer.current) { clearTimeout(aiAlertTimer.current); aiAlertTimer.current = null; }
    setAiBoxes([]);
    setAiAlert(null);
    
    if (socketRef.current && socketRef.current.connected && streamIdRef.current) {
      socketRef.current.emit('stop-stream', streamIdRef.current);
    }
    
    setIsStreaming(false);
    isStreamingRef.current = false;
    setIsRecording(false);
    setStreamId(null);
    streamIdRef.current = null;
    setViewerCount(0);
    setStreamDuration(0);
    setFrameCount(0);
    
    showToast('Stream Ended', 'Your live stream has been stopped.', 'info');
    setTimeout(() => router.back(), 1200);
  };

  const toggleCamera = () => {
    const newType = cameraType === 'back' ? 'front' : 'back';
    setCameraType(newType);
    if (newType === 'front') setTorchOn(false); // front camera has no torch
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

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        enableTorch={torchOn && cameraType === 'back'}
        onLayout={e => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setCameraLayout({ w, h });
        }}
      >
        {/* ── Connecting / starting overlay ───────────────────── */}
        {!isStreaming && (
          <View style={styles.connectingOverlay}>
            <View style={styles.connectingCard}>
              <ActivityIndicator color="#E63939" size="large" />
              <Text style={styles.connectingOverlayText}>
                {connectionStatus === 'connecting'
                  ? 'Connecting to server…'
                  : isLoading
                    ? 'Starting stream…'
                    : 'Starting stream…'}
              </Text>
              <View style={styles.connectingDotRow}>
                <View style={[styles.connectingDot, connectionStatus === 'connected' && styles.connectingDotOn]} />
                <Text style={styles.connectingDotLabel}>
                  {connectionStatus === 'connected' ? 'Connected' : 'Connecting…'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.connectingBackBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.connectingBackText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* ── AI bounding box overlay ─────────────────────────── */}
        {aiEnabled && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <BoundingBoxes
              boxes={aiBoxes}
              viewW={cameraLayout.w}
              viewH={cameraLayout.h}
            />
          </View>
        )}

        {/* ── AI Alert banner ─────────────────────────────────── */}
        {aiAlert && (
          <View style={styles.aiAlertBanner}>
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.aiAlertText}>{aiAlert}</Text>
          </View>
        )}

        {/* ── Toast notification ──────────────────────────────── */}
        {toast && (
          <Animated.View style={[
            styles.toast,
            toast.type === 'success' && styles.toastSuccess,
            toast.type === 'error'   && styles.toastError,
            toast.type === 'info'    && styles.toastInfo,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
            }
          ]}>
            <View style={styles.toastIcon}>
              <Ionicons
                name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'close-circle' : 'information-circle'}
                size={22}
                color={toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6'}
              />
            </View>
            <View style={styles.toastBody}>
              <Text style={styles.toastTitle}>{toast.message}</Text>
              {toast.sub ? <Text style={styles.toastSub}>{toast.sub}</Text> : null}
            </View>
          </Animated.View>
        )}

        {/* ── Top HUD ─────────────────────────────────────────── */}
        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'transparent']}
          style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.streamInfo}>
            {/* LIVE pill */}
            <View style={styles.liveBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            {/* Viewers */}
            <View style={styles.hudChip}>
              <Ionicons name="eye" size={12} color="#fff" />
              <Text style={styles.hudChipText}>{viewerCount}</Text>
            </View>
            {/* Duration */}
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>{formatDuration(streamDuration)}</Text>
            </View>
            {/* Frames */}
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>📡 {frameCount}</Text>
            </View>
          </View>

          {/* AI toggle + close */}
          <View style={styles.topRight}>
            <TouchableOpacity
              style={[styles.aiToggleBtn, aiEnabled && styles.aiToggleBtnOn]}
              onPress={() => { setAiEnabled(v => !v); if (aiEnabled) setAiBoxes([]); }}
            >
              <Ionicons name="scan-outline" size={16} color={aiEnabled ? '#000' : '#fff'} />
              <Text style={[styles.aiToggleText, aiEnabled && { color: '#000' }]}>AI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={stopStreaming}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── REC badge ───────────────────────────────────────── */}
        {isRecording && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}

        {/* ── Detected objects legend (bottom-left) ───────────── */}
        {aiEnabled && aiBoxes.length > 0 && (
          <View style={styles.legend}>
            {[...new Set(aiBoxes.map(b => b.label))].slice(0, 5).map(label => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: getLabelColor(label) }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Bottom controls ─────────────────────────────────── */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}
        >
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={22} color="#fff" />
            </TouchableOpacity>
            {/* Torch — only useful on back camera */}
            {cameraType === 'back' && (
              <TouchableOpacity
                style={[styles.controlButton, torchOn && styles.torchOnButton]}
                onPress={() => setTorchOn(v => !v)}
              >
                <Ionicons
                  name={torchOn ? 'flashlight' : 'flashlight-outline'}
                  size={22}
                  color={torchOn ? '#000' : '#fff'}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={stopStreaming}>
              <Ionicons name="call" size={22} color="#fff" />
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

  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 99,
  },
  connectingCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 32, paddingVertical: 28, alignItems: 'center', gap: 12, minWidth: 220,
  },
  connectingOverlayText: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  connectingDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  connectingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  connectingDotOn: { backgroundColor: '#10b981' },
  connectingDotLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  connectingBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  connectingBackText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  // ── Pre-stream screens ────────────────────────────────────────────────────
  connectionStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20,
  },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  connectedDot: { backgroundColor: '#10b981' },
  disconnectedDot: { backgroundColor: '#ef4444' },
  connectionText: { color: '#94a3b8', fontSize: 12 },
  streamPreview: { alignItems: 'center', marginBottom: 40 },
  previewIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(230,57,57,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  previewTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  previewText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
  locationInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  locationText: { color: '#94a3b8', fontSize: 12 },
  startButton: { width: width - 80, borderRadius: 30, overflow: 'hidden', marginTop: 20 },
  startGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
  permissionText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  permissionButton: { backgroundColor: '#E63939', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  connectingText: { color: '#fff', fontSize: 18, marginTop: 20 },
  connectingSubText: { color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' },
  retryButton: { backgroundColor: '#E63939', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ── Live overlays ─────────────────────────────────────────────────────────
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingBottom: 20,
  },
  streamInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E63939',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 6,
  },
  livePulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  hudChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14,
  },
  hudChipText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  aiToggleBtnOn: { backgroundColor: '#facc15', borderColor: '#facc15' },
  aiToggleText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, borderRadius: 20 },

  recBadge: {
    position: 'absolute', top: 100, right: 14, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E63939', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, gap: 5,
  },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  recText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 30, alignItems: 'center',
  },
  controls: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.65)', padding: 14, borderRadius: 40,
    width: 58, height: 58, alignItems: 'center', justifyContent: 'center',
  },
  endButton: { backgroundColor: '#E63939' },
  torchOnButton: { backgroundColor: '#facc15' },
  streamingHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 },

  // ── Toast notification ────────────────────────────────────────────────────
  toast: {
    position: 'absolute', top: 80, left: 20, right: 20, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  toastSuccess: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(6,25,35,0.97)' },
  toastError:   { borderColor: 'rgba(239,68,68,0.4)',  backgroundColor: 'rgba(30,6,6,0.97)' },
  toastInfo:    { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(6,15,30,0.97)' },
  toastIcon: { flexShrink: 0 },
  toastBody: { flex: 1 },
  toastTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  toastSub:   { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  // ── AI Alert banner ───────────────────────────────────────────────────────
  aiAlertBanner: {
    position: 'absolute', top: '50%', left: 20, right: 20,
    backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#f87171',
  },
  aiAlertText: { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'center' },

  // ── Detected objects legend ───────────────────────────────────────────────
  legend: {
    position: 'absolute', bottom: 120, left: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, gap: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // ── Bounding boxes ────────────────────────────────────────────────────────
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },

  // Corner accent pieces (L-shaped corners on each box corner)
  corner: {
    position: 'absolute',
    width: 12, height: 12,
    borderColor: 'transparent',
  },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 },

  // Label chip sits at top-left of each box
  labelChip: {
    position: 'absolute',
    top: -18,
    left: -1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});