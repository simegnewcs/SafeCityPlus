// app/emergency-report.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { storage } from '../utils/storage'; // Import custom storage
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface AIAnalysis {
  type: string;
  confidence: number;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  description: string;
  timestamp: string;
  objects?: Array<{
    class: string;
    confidence: number;
  }>;
}

export default function EmergencyReportPage() {
  const { mode } = useLocalSearchParams();
  const router = useRouter();
  const isGuest = mode === 'guest';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('connected');
  const [showMode, setShowMode] = useState<'choice' | 'photo' | 'video'>('choice');
  const [description, setDescription] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const videoRef = useRef<Video>(null);

  const incidentTypes = [
    'Car Accident',
    'Fire',
    'Medical Emergency',
    'Fighting',
    'Theft',
    'Flooding',
    'Earthquake',
    'Other'
  ];

  useEffect(() => {
    checkPermissions();
    getLocation();
    setupNetworkListener();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      
      setHasPermission(
        cameraStatus.status === 'granted' && 
        audioStatus.status === 'granted' && 
        locationStatus.status === 'granted'
      );
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    }
  };

  const setupNetworkListener = () => {
    // Simulate network status
    const interval = setInterval(() => {
      const statuses = ['connected', 'connected', 'connected', 'connected', 'disconnected'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      setNetworkStatus(randomStatus);
    }, 10000);

    return () => clearInterval(interval);
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(location);

      // Get address from coordinates
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const formattedAddress = [
          address.street,
          address.district,
          address.city,
          address.region
        ].filter(Boolean).join(', ');
        setAddress(formattedAddress || 'Address not available');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get your location. Please enable GPS.');
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: true,
      });

      setSelectedImage(photo.uri);
      setShowPreview(true);
      
      // Analyze image
      analyzeImage(photo.base64 || '');
      
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setLoading(false);
    }
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
        quality: Camera.Constants.VideoQuality['720p'],
      });

      setSelectedVideo(video.uri);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video');
    } finally {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const stopVideoRecording = async () => {
    if (!cameraRef.current) return;
    
    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.type === 'image') {
          setSelectedImage(asset.uri);
          analyzeImage(asset.base64 || '');
        } else {
          setSelectedVideo(asset.uri);
        }
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setAnalyzing(true);
    
    try {
      // Simulate AI analysis with progress
      for (let i = 0; i <= 100; i += 20) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Mock AI analysis
      const types = ['Car Accident', 'Fire', 'Medical Emergency', 'Fighting', 'Flooding'];
      const severities = ['Low', 'Medium', 'High'];
      const priorities = ['Normal', 'High', 'Critical'];
      
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
      const randomPriority = randomSeverity === 'High' ? 'Critical' : 
                            randomSeverity === 'Medium' ? 'High' : 'Normal';
      
      const analysis: AIAnalysis = {
        type: randomType,
        confidence: Number((0.7 + Math.random() * 0.25).toFixed(2)),
        severity: randomSeverity as 'Low' | 'Medium' | 'High',
        priority: randomPriority as 'Normal' | 'High' | 'Critical',
        description: `${randomType} detected with ${randomSeverity.toLowerCase()} severity. Immediate attention may be required.`,
        timestamp: new Date().toISOString(),
        objects: [
          { class: 'person', confidence: 0.95 },
          { class: randomType.toLowerCase(), confidence: 0.88 },
          { class: 'vehicle', confidence: 0.76 }
        ]
      };

      setAiAnalysis(analysis);
      setIncidentType(analysis.type);
      
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Analysis Failed', 'Unable to analyze image');
    } finally {
      setAnalyzing(false);
      setUploadProgress(0);
    }
  };

  const submitReport = async () => {
    if (!selectedImage && !selectedVideo) {
      Alert.alert('Error', 'Please capture or select media');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    if (!incidentType) {
      Alert.alert('Error', 'Please select incident type');
      return;
    }

    setLoading(true);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Get user info
      const userId = await storage.getItem('userId') || 'guest';
      const userName = await storage.getItem('fullName') || 'Guest User';

      // Prepare report data
      const reportData = {
        id: `rep_${Date.now()}`,
        type: incidentType,
        severity: aiAnalysis?.severity || 'Medium',
        priority: aiAnalysis?.priority || 'Normal',
        description: description.trim(),
        location: {
          lat: location?.coords.latitude,
          lng: location?.coords.longitude,
          address: address,
        },
        media: {
          type: selectedImage ? 'image' : 'video',
          url: selectedImage || selectedVideo,
        },
        reporter: {
          id: userId,
          name: userName,
          isGuest,
        },
        aiAnalysis: aiAnalysis || {
          type: incidentType,
          confidence: 0,
          severity: 'Medium',
          priority: 'Normal',
          description: 'Manual report without AI analysis',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      // Save to storage
      const reports = await storage.getItem('emergencyReports') || '[]';
      const allReports = JSON.parse(reports);
      allReports.push(reportData);
      await storage.setItem('emergencyReports', JSON.stringify(allReports));

      Alert.alert(
        'Success',
        'Emergency report submitted successfully! Responders have been notified.',
        [
          {
            text: 'OK',
            onPress: () => router.push(isGuest ? '/' : '/(tabs)')
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High': return '#E63939';
      case 'Medium': return '#FB923C';
      case 'Low': return '#4ADE80';
      default: return '#94a3b8';
    }
  };

  const renderPreviewModal = () => (
    <Modal
      visible={showPreview}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPreview(false)}
    >
      <BlurView intensity={90} style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Evidence</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPreview(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.modalImage} />
            )}

            {selectedVideo && (
              <Video
                ref={videoRef}
                source={{ uri: selectedVideo }}
                style={styles.modalVideo}
                useNativeControls
                resizeMode="contain"
                isLooping
              />
            )}

            {analyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color="#ffcc00" />
                <Text style={styles.analyzingText}>AI Analyzing...</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            )}

            {aiAnalysis && (
              <BlurView intensity={80} style={styles.aiPreview}>
                <Text style={styles.aiPreviewTitle}>🤖 AI Analysis</Text>
                <View style={styles.aiPreviewRow}>
                  <Text style={styles.aiPreviewLabel}>Type:</Text>
                  <Text style={styles.aiPreviewValue}>{aiAnalysis.type}</Text>
                </View>
                <View style={styles.aiPreviewRow}>
                  <Text style={styles.aiPreviewLabel}>Confidence:</Text>
                  <Text style={[styles.aiPreviewValue, { 
                    color: aiAnalysis.confidence > 0.8 ? '#4ADE80' : '#FB923C' 
                  }]}>
                    {Math.round(aiAnalysis.confidence * 100)}%
                  </Text>
                </View>
                <View style={styles.aiPreviewRow}>
                  <Text style={styles.aiPreviewLabel}>Severity:</Text>
                  <View style={[styles.severityBadge, { 
                    backgroundColor: getSeverityColor(aiAnalysis.severity) 
                  }]}>
                    <Text style={styles.severityBadgeText}>{aiAnalysis.severity}</Text>
                  </View>
                </View>
              </BlurView>
            )}

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Incident Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeChipContainer}>
                  {incidentTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        incidentType === type && styles.typeChipActive
                      ]}
                      onPress={() => setIncidentType(type)}
                    >
                      <Text style={[
                        styles.typeChipText,
                        incidentType === type && styles.typeChipTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe what happened..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowPreview(false);
                setSelectedImage(null);
                setSelectedVideo(null);
                setAiAnalysis(null);
              }}
            >
              <Text style={styles.modalButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalButton, 
                styles.submitButton,
                (loading || !incidentType || !description) && styles.disabledButton
              ]}
              onPress={submitReport}
              disabled={loading || !incidentType || !description}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#E63939" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <LinearGradient colors={['#0A2540', '#1E3A5F']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            SafeCity+ needs camera access to capture evidence of emergencies.
            Please grant camera permission in your settings.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={checkPermissions}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionSkip}
            onPress={() => router.back()}
          >
            <Text style={styles.permissionSkipText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        ratio="16:9"
      >
        {/* Network Status */}
        <View style={[styles.networkStatus, { 
          backgroundColor: networkStatus === 'connected' ? '#4ADE80' : '#E63939' 
        }]}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>
            {networkStatus === 'connected' ? 'Live' : 'Offline'}
          </Text>
        </View>

        {/* Recording Indicator */}
        {isRecording && (
          <BlurView intensity={80} style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC {formatTime(recordingTime)}</Text>
          </BlurView>
        )}

        {/* Location Indicator */}
        {location && (
          <BlurView intensity={80} style={styles.locationIndicator}>
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {address || 'Location captured'}
            </Text>
          </BlurView>
        )}

        {/* Mode Selection */}
        {showMode === 'choice' && !isRecording && !selectedImage && !selectedVideo && (
          <View style={styles.modeSelection}>
            <TouchableOpacity
              style={[styles.modeButton, styles.photoMode]}
              onPress={() => {
                setShowMode('photo');
                takePhoto();
              }}
            >
              <Text style={styles.modeEmoji}>📸</Text>
              <Text style={styles.modeText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, styles.videoMode]}
              onPress={() => {
                setShowMode('video');
                startVideoRecording();
              }}
            >
              <Text style={styles.modeEmoji}>🎥</Text>
              <Text style={styles.modeText}>Record Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, styles.galleryMode]}
              onPress={pickFromGallery}
            >
              <Text style={styles.modeEmoji}>🖼️</Text>
              <Text style={styles.modeText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recording Controls */}
        {showMode === 'video' && !isRecording && !selectedVideo && (
          <TouchableOpacity
            style={styles.startRecordingButton}
            onPress={startVideoRecording}
          >
            <LinearGradient
              colors={['#E63939', '#B91C1C']}
              style={styles.startRecordingGradient}
            >
              <Text style={styles.startRecordingText}>▶ Start Recording</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {isRecording && (
          <TouchableOpacity
            style={styles.stopRecordingButton}
            onPress={stopVideoRecording}
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        )}

        {/* Flip Camera Button */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setCameraType(
            cameraType === CameraType.back ? CameraType.front : CameraType.back
          )}
        >
          <Text style={styles.flipText}>🔄</Text>
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isRecording) {
              Alert.alert(
                'Stop Recording',
                'Are you sure you want to stop?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Stop', onPress: stopVideoRecording }
                ]
              );
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </Camera>

      {/* Preview Modal */}
      {renderPreviewModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#E63939',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionSkip: {
    padding: 15,
  },
  permissionSkipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  networkStatus: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  networkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E63939',
    marginRight: 6,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  locationText: {
    color: '#ffcc00',
    fontSize: 12,
    textAlign: 'center',
  },
  modeSelection: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  photoMode: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
  },
  videoMode: {
    backgroundColor: 'rgba(230, 57, 57, 0.9)',
  },
  galleryMode: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
  },
  modeEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  startRecordingButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    borderRadius: 30,
    overflow: 'hidden',
  },
  startRecordingGradient: {
    paddingHorizontal: 40,
    paddingVertical: 15,
  },
  startRecordingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopRecordingButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIcon: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: '#E63939',
  },
  flipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipText: {
    color: '#fff',
    fontSize: 24,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  analyzingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  analyzingText: {
    color: '#ffcc00',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#2D4A6F',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffcc00',
  },
  aiPreview: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  aiPreviewTitle: {
    color: '#ffcc00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aiPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiPreviewLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  aiPreviewValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  typeChipContainer: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0A2540',
    marginRight: 10,
  },
  typeChipActive: {
    backgroundColor: '#E63939',
  },
  typeChipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  typeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  descriptionInput: {
    backgroundColor: '#0A2540',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
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
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#0A2540',
  },
  submitButton: {
    backgroundColor: '#E63939',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});