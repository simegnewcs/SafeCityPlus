import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Image, 
  Dimensions, Animated, PanResponder, Alert, ActivityIndicator,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions, FlashMode, CameraMode } from 'expo-camera';
import { Video } from 'expo-av'; // Add this import for video playback
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [cameraMode, setCameraMode] = useState<CameraMode>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  
  const cameraRef = useRef<any>(null);
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const recordingTimer = useRef<NodeJS.Timeout>();
  const isRecordingRef = useRef(false);

  useEffect(() => {
    requestAudioPermissions();
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (isRecordingRef.current && cameraRef.current) {
        cameraRef.current.stopRecording().catch(console.error);
      }
    };
  }, []);

  const requestAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
      console.log('Audio permission status:', status);
    } catch (error) {
      console.error('Audio permission error:', error);
      setAudioPermission(false);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const animateCapture = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const detectObjects = async (mediaUri: string, isVideo: boolean = false) => {
    setIsAnalyzing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockDetections = isVideo 
        ? ['Vehicle Detected', 'Person Walking', 'Check Surroundings']
        : ['Person Detected', 'Vehicle Present', 'Check Surroundings'];
      setDetectedObjects(mockDetections);
      return mockDetections;
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      if (cameraRef.current) {
        const focusX = locationX / width;
        const focusY = locationY / height;
        cameraRef.current.setFocusPoint?.({ x: focusX, y: focusY });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
  });

  const takePicture = async () => {
    if (cameraRef.current && !isRecording) {
      animateCapture();
      
      try {
        const options = { quality: 0.9, base64: false, exif: true };
        const data = await cameraRef.current.takePictureAsync(options);
        
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          data.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        await detectObjects(manipulatedImage.uri);
        setPhoto(manipulatedImage.uri);
        setVideo(null);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current || isRecording) {
      console.log('Recording already in progress');
      return;
    }
    
    if (!cameraRef.current) {
      console.log('Camera ref not available');
      return;
    }
    
    if (cameraMode !== 'video') {
      console.log('Not in video mode');
      return;
    }
    
    try {
      console.log('🎥 Starting video recording...');
      animateCapture();
      
      setRecordingTime(0);
      setVideoDuration(0);
      
      const recordingOptions = {
        maxDuration: 60,
        quality: '720p' as const,
        mute: audioPermission !== true,
      };
      
      isRecordingRef.current = true;
      setIsRecording(true);
      
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          setVideoDuration(newTime);
          return newTime;
        });
      }, 1000);
      
      const videoRecord = await cameraRef.current.recordAsync(recordingOptions);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = undefined;
      }
      
      console.log('📹 Video recorded:', videoRecord);
      
      if (videoRecord && videoRecord.uri) {
        setVideo(videoRecord.uri);
        setPhoto(null);
        await detectObjects(videoRecord.uri, true);
        
        Alert.alert(
          'Video Recorded',
          `Video saved! Duration: ${formatTime(videoDuration)}`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = undefined;
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current && !isRecording) {
      console.log('No recording to stop');
      return;
    }
    
    console.log('🛑 Stopping recording...');
    
    try {
      if (cameraRef.current) {
        await cameraRef.current.stopRecording();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = undefined;
      }
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const handleReport = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const mediaUri = photo || video;
      const mediaType = video ? 'video' : 'image';
      
      router.push({
        pathname: '/report-details',
        params: { 
          photoUri: mediaUri,
          mediaType: mediaType,
          videoDuration: videoDuration.toString(),
          latitude: location.coords.latitude.toString(), 
          longitude: location.coords.longitude.toString(),
          detectedObjects: JSON.stringify(detectedObjects)
        }
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get your location. Please enable GPS.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingPermissions || !cameraPermission) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#E63939" />
          <Text style={styles.permissionText}>Loading camera...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!cameraPermission?.granted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={60} color="#E63939" />
          <Text style={styles.permissionText}>Camera access is required</Text>
          <Text style={styles.permissionSubtext}>SafeCity+ needs camera access to capture incident evidence</Text>
          <TouchableOpacity onPress={requestCameraPermission} style={styles.permissionBtn}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {!photo && !video ? (
        <CameraView 
          style={styles.camera} 
          ref={cameraRef} 
          zoom={zoom}
          flash={flash}
          mode={cameraMode}
          animateShutter={true}
          enableTorch={torchEnabled}
          {...panResponder.panHandlers}
        >
          {/* Grid Overlay */}
          {showGrid && (
            <View style={styles.gridOverlay}>
              <View style={styles.gridLineHorizontal} />
              <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
              <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
              <View style={styles.gridLineVertical} />
              <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
              <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
            </View>
          )}

          {/* AI Focus Frame */}
          <View style={styles.overlay}>
            <View style={styles.focusFrame}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
              <View style={styles.aiBadge}>
                <Ionicons name="scan-outline" size={12} color="#E63939" />
                <Text style={styles.aiBadgeText}>AI SCAN AREA</Text>
              </View>
            </View>
          </View>

          {/* Recording Indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
            </View>
          )}

          {/* Top Controls */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.topControls}
          >
            <TouchableOpacity onPress={() => router.back()} style={styles.controlButton}>
              <Ionicons name="close-circle" size={32} color="white" />
            </TouchableOpacity>
            
            <View style={styles.topControlsRight}>
              <TouchableOpacity onPress={() => setShowGrid(!showGrid)} style={styles.controlButton}>
                <Ionicons name={showGrid ? "grid" : "grid-outline"} size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setFlash(flash === 'off' ? 'on' : 'off')} style={styles.controlButton}>
                <Ionicons name={flash === 'on' ? "flash" : "flash-off"} size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setTorchEnabled(!torchEnabled)} style={styles.controlButton}>
                <Ionicons name={torchEnabled ? "flashlight" : "flashlight-outline"} size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Bottom Controls */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomControls}
          >
            <View style={styles.modeSelector}>
              <TouchableOpacity 
                style={[styles.modeButton, cameraMode === 'picture' && styles.activeMode]}
                onPress={() => setCameraMode('picture')}
              >
                <Ionicons name="camera" size={20} color={cameraMode === 'picture' ? '#E63939' : 'white'} />
                <Text style={[styles.modeText, cameraMode === 'picture' && styles.activeModeText]}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeButton, cameraMode === 'video' && styles.activeMode]}
                onPress={() => setCameraMode('video')}
              >
                <Ionicons name="videocam" size={20} color={cameraMode === 'video' ? '#E63939' : 'white'} />
                <Text style={[styles.modeText, cameraMode === 'video' && styles.activeModeText]}>Video</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.zoomContainer}>
              <Ionicons name="remove" size={20} color="white" />
              <View style={styles.sliderWrapper}>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${zoom * 200}%` }]} />
                </View>
                <View style={styles.sliderHandle} />
              </View>
              <Ionicons name="add" size={20} color="white" />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.captureButtonWrapper}
                onPress={cameraMode === 'picture' ? takePicture : undefined}
                onLongPress={cameraMode === 'video' ? startRecording : undefined}
                onPressOut={cameraMode === 'video' && isRecording ? stopRecording : undefined}
                activeOpacity={0.8}
              >
                <Animated.View style={[styles.captureButton, { transform: [{ scale: scaleAnim }] }]}>
                  <LinearGradient
                    colors={isRecording ? ['#ef4444', '#dc2626'] : ['#E63939', '#ff6b6b']}
                    style={styles.captureGradient}
                  >
                    {cameraMode === 'video' && isRecording ? (
                      <View style={styles.recordingSquare} />
                    ) : (
                      <View style={styles.innerCircle} />
                    )}
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.captureHint}>
                {cameraMode === 'picture' ? 'Tap to capture' : isRecording ? 'Release to stop' : 'Hold to record'}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.focusHint}>
            <Ionicons name="hand-left-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.focusHintText}>Tap anywhere to focus</Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.preview} />
          ) : (
            <Video
              source={{ uri: video }}
              style={styles.preview}
              useNativeControls
              resizeMode="contain"
              isLooping
              shouldPlay
            />
          )}
          
          {detectedObjects.length > 0 && (
            <View style={styles.detectionResults}>
              <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent']} style={styles.detectionHeader}>
                <Ionicons name="scan-outline" size={18} color="#E63939" />
                <Text style={styles.detectionTitle}>AI Detection Results</Text>
              </LinearGradient>
              <View style={styles.detectionList}>
                {detectedObjects.map((obj, index) => (
                  <View key={index} style={styles.detectionItem}>
                    <Ionicons name="warning-outline" size={14} color="#E63939" />
                    <Text style={styles.detectionText}>{obj}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {isAnalyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#E63939" />
              <Text style={styles.analyzingText}>AI Analyzing Scene...</Text>
            </View>
          )}
          
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => {
              setPhoto(null);
              setVideo(null);
              setDetectedObjects([]);
              setVideoDuration(0);
            }} style={styles.retryButton}>
              <Ionicons name="refresh" size={24} color="white" />
              <Text style={styles.btnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReport} style={styles.sendButton}>
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text style={styles.btnText}>Confirm & Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  focusFrame: { width: width * 0.6, height: width * 0.6, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderLeftWidth: 3, borderTopWidth: 3, borderColor: '#E63939' },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderRightWidth: 3, borderTopWidth: 3, borderColor: '#E63939' },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: '#E63939' },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRightWidth: 3, borderBottomWidth: 3, borderColor: '#E63939' },
  aiBadge: { position: 'absolute', bottom: -30, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
  topControls: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  topControlsRight: { flexDirection: 'row', gap: 15 },
  controlButton: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },
  modeSelector: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, alignSelf: 'center', padding: 5 },
  modeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25 },
  activeMode: { backgroundColor: 'rgba(230, 57, 57, 0.3)' },
  modeText: { color: 'white', fontSize: 14, fontWeight: '500' },
  activeModeText: { color: '#E63939' },
  zoomContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  sliderWrapper: { flex: 1, marginHorizontal: 10, position: 'relative', height: 30, justifyContent: 'center' },
  sliderTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  sliderFill: { height: 2, backgroundColor: '#E63939', borderRadius: 2 },
  sliderHandle: { position: 'absolute', width: 12, height: 12, backgroundColor: '#E63939', borderRadius: 6, top: 9, left: '50%' },
  buttonContainer: { alignItems: 'center' },
  captureButtonWrapper: { alignItems: 'center', justifyContent: 'center' },
  captureButton: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden' },
  captureGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white', borderWidth: 2, borderColor: '#E63939' },
  recordingSquare: { width: 30, height: 30, backgroundColor: 'white', borderRadius: 6 },
  captureHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },
  focusHint: { position: 'absolute', bottom: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  focusHintText: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  recordingIndicator: { position: 'absolute', top: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E63939' },
  recordingTime: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  previewContainer: { flex: 1, backgroundColor: '#0f172a' },
  preview: { flex: 1, borderRadius: 20, margin: 10 },
  detectionResults: { position: 'absolute', top: 70, left: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, overflow: 'hidden' },
  detectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  detectionTitle: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  detectionList: { paddingHorizontal: 12, paddingBottom: 12 },
  detectionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detectionText: { color: '#E63939', fontSize: 11, fontWeight: '500' },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  analyzingText: { color: 'white', marginTop: 12, fontSize: 14 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', padding: 25, paddingBottom: 40 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#334155', borderRadius: 15, flex: 1, marginRight: 10, justifyContent: 'center' },
  sendButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#E63939', borderRadius: 15, flex: 1, justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  permissionText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  permissionSubtext: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 10, marginBottom: 30 },
  permissionBtn: { backgroundColor: '#E63939', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12 },
  permissionBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});