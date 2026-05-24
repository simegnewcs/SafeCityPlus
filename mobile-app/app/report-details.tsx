import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  Platform, Dimensions, Animated, Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { reportIncident } from '../services/incidentService';
import AppLoader from '../components/AppLoader';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

export default function ReportDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Get params from navigation with safe defaults
  const photoUri = params.photoUri as string || '';
  const latitude = params.latitude as string || '0';
  const longitude = params.longitude as string || '0';
  const mediaType = (params.mediaType as string) || 'image';
  const videoDuration = params.videoDuration ? parseInt(params.videoDuration as string) : 0;
  
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [isGettingAddress, setIsGettingAddress] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    getAddressFromCoordinates();
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getAddressFromCoordinates = async () => {
    if (!latitude || !longitude || latitude === '0' || longitude === '0') return;
    
    setIsGettingAddress(true);
    try {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      const address = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      
      if (address && address[0]) {
        const addr = address[0];
        const addressString = [
          addr.name,
          addr.street,
          addr.district,
          addr.city,
          addr.region,
        ].filter(Boolean).join(', ');
        setLocationAddress(addressString);
      }
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      setIsGettingAddress(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("ማሳሰቢያ", "እባክዎ ስለ አደጋው አጭር መግለጫ ይጻፉ");
      return;
    }

    if (!photoUri) {
      Alert.alert("ስህተት", "No media captured. Please try again.");
      return;
    }

    setIsUploading(true);
    try {
      const location = { 
        coords: { 
          latitude: parseFloat(latitude as string), 
          longitude: parseFloat(longitude as string) 
        } 
      };
      
      const result = await reportIncident(
        photoUri, 
        location, 
        description, 
        mediaType
      );
      
      console.log('Report submitted:', result);
      
      // Store AI results for display
      if (result.ai_analysis) {
        setAiResults(result.ai_analysis);
      }
      
      Alert.alert(
        "ተሳክቷል!", 
        `ሪፖርቱ በስኬት ተልኳል!\n\n🤖 AI ማወቂያ: ${result.ai_analysis?.primary_incident?.type || 'Unknown'}\n⚠️ ቅድሚያ: ${result.ai_analysis?.primary_incident?.priority || 'Normal'}\n📊 እምነት: ${Math.round((result.ai_analysis?.primary_incident?.confidence || 0) * 100)}%`,
        [
          { 
            text: "ሪፖርቶቼን እመለከት", 
            onPress: () => router.replace('/(tabs)/reports')
          },
          { 
            text: "ወደ መነሻ", 
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert(
        "ስህተት", 
        error.response?.data?.message || "ሪፖርቱን መላክ አልተቻለም። እባክዎ ደግመው ይሞክሩ።"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚨 Emergency Report\n\n📍 Location: ${latitude}, ${longitude}\n📝 Description: ${description}\n📹 Media: ${mediaType}\n\nReported via SafeCity+ App - Emergency Response System`,
        title: 'SafeCity+ Emergency Report',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  // Show loading if no photoUri
  if (!photoUri) {
    return (
      <AppLoader message="Loading..." />
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={22} color="white" />
          </TouchableOpacity>
        </Animated.View>

        {/* Media Preview */}
        <Animated.View style={[styles.mediaContainer, { opacity: fadeAnim }]}>
          <View style={styles.mediaWrapper}>
            {mediaType === 'video' ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: photoUri }}
                  style={styles.video}
                  useNativeControls
                  resizeMode="contain"
                  isLooping={false}
                  shouldPlay={false}
                  onPlaybackStatusUpdate={setVideoStatus}
                />
                <View style={styles.videoDurationBadge}>
                  <Ionicons name="videocam" size={12} color="white" />
                  <Text style={styles.videoDurationText}>
                    {videoDuration > 0 ? formatTime(videoDuration) : 
                      videoStatus?.durationMillis ? formatTime(Math.floor(videoStatus.durationMillis / 1000)) : '00:00'}
                  </Text>
                </View>
              </View>
            ) : (
              <Image source={{ uri: photoUri }} style={styles.image} />
            )}
          </View>
        </Animated.View>

        {/* AI Detection Results (after submission) */}
        {aiResults && (
          <Animated.View style={[styles.aiResultsCard, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={['rgba(230, 57, 57, 0.15)', 'rgba(230, 57, 57, 0.05)']}
              style={styles.aiResultsGradient}
            >
              <View style={styles.aiResultsHeader}>
                <View style={styles.aiIconContainer}>
                  <Ionicons name="scan-circle" size={28} color="#E63939" />
                </View>
                <Text style={styles.aiResultsTitle}>AI Analysis Results</Text>
              </View>

              {/* Primary Detection */}
              <View style={styles.primaryDetection}>
                <Text style={styles.primaryType}>{aiResults.primary_incident?.type || 'Unknown Incident'}</Text>
                <View style={styles.priorityContainer}>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(aiResults.primary_incident?.priority) + '20' }]}>
                    <Ionicons name="alert-circle" size={12} color={getPriorityColor(aiResults.primary_incident?.priority)} />
                    <Text style={[styles.priorityText, { color: getPriorityColor(aiResults.primary_incident?.priority) }]}>
                      {aiResults.primary_incident?.priority || 'Normal'} Priority
                    </Text>
                  </View>
                  <View style={styles.confidenceContainer}>
                    <View style={styles.confidenceBar}>
                      <View 
                        style={[
                          styles.confidenceFill, 
                          { width: `${Math.round((aiResults.primary_incident?.confidence || 0) * 100)}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.confidenceText}>
                      {Math.round((aiResults.primary_incident?.confidence || 0) * 100)}% confidence
                    </Text>
                  </View>
                </View>
              </View>

              {/* All Detected Objects */}
              {aiResults.all_detections && aiResults.all_detections.length > 0 && (
                <View style={styles.detectionsSection}>
                  <Text style={styles.detectionsTitle}>
                    🎯 Detected Objects ({aiResults.all_detections.length})
                  </Text>
                  <View style={styles.detectionsGrid}>
                    {aiResults.all_detections.slice(0, 10).map((detection: any, index: number) => (
                      <View key={index} style={styles.detectionCard}>
                        <View style={styles.detectionHeader}>
                          <Ionicons name="cube-outline" size={14} color="#E63939" />
                          <Text style={styles.detectionName}>{detection.type}</Text>
                        </View>
                        <View style={styles.detectionStats}>
                          <Text style={styles.detectionConfidence}>
                            {Math.round((detection.confidence || 0) * 100)}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        {/* Location Info */}
        <Animated.View style={[styles.locationCard, { opacity: fadeAnim }]}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={20} color="#E63939" />
            </View>
            <Text style={styles.locationTitle}>Incident Location</Text>
          </View>
          
          {isGettingAddress ? (
            <ActivityIndicator size="small" color="#E63939" style={styles.locationLoader} />
          ) : (
            <>
              {locationAddress ? (
                <Text style={styles.locationAddress}>{locationAddress}</Text>
              ) : null}
              <Text style={styles.locationCoordinates}>
                📍 {parseFloat(latitude).toFixed(6)}°, {parseFloat(longitude).toFixed(6)}°
              </Text>
            </>
          )}
          
          <View style={styles.locationNote}>
            <Ionicons name="information-circle-outline" size={14} color="#64748b" />
            <Text style={styles.locationNoteText}>
              This location will be shared with emergency responders
            </Text>
          </View>
        </Animated.View>

        {/* Description Input */}
        <Animated.View style={[styles.inputCard, { opacity: fadeAnim }]}>
          <View style={styles.inputHeader}>
            <Ionicons name="document-text-outline" size={20} color="#E63939" />
            <Text style={styles.inputLabel}>Incident Description</Text>
          </View>
          <TextInput
            style={[styles.input, showFullDescription && styles.inputExpanded]}
            placeholder="What happened? (e.g., serious car accident, fire, etc.)"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={showFullDescription ? 8 : 4}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            textAlignVertical="top"
          />
          <View style={styles.inputFooter}>
            <Text style={styles.charCount}>{description.length}/500 characters</Text>
            <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
              <Text style={styles.expandText}>
                {showFullDescription ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Quick Description Suggestions */}
        <Animated.View style={[styles.suggestionsCard, { opacity: fadeAnim }]}>
          <Text style={styles.suggestionsTitle}>Quick Description</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {[
              'Car accident with injuries',
              'Fire in building',
              'Suspicious activity',
              'Medical emergency',
              'Road obstruction',
              'Flooding'
            ].map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => setDescription(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Submit Button */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity 
            style={[styles.submitButton, isUploading && styles.disabledButton]} 
            onPress={handleSubmit}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isUploading ? ['#6c6c6c', '#5a5a5a'] : ['#E63939', '#b91c1c']}
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitText}>Submit Report</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Note */}
        <Animated.View style={[styles.noteContainer, { opacity: fadeAnim }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#3b82f6" />
          <Text style={styles.noteText}>
            Your report will be analyzed by AI and sent to emergency responders immediately
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: 'transparent'
  },
  backButton: { 
    padding: 8, 
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  shareButton: { 
    padding: 8, 
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30
  },
  
  // Media
  mediaContainer: { 
    alignItems: 'center', 
    marginBottom: 20,
    paddingHorizontal: 20
  },
  mediaWrapper: {
    width: width - 40,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  image: { 
    width: '100%', 
    height: 280, 
    backgroundColor: '#1e293b' 
  },
  videoContainer: { 
    width: '100%', 
    height: 280, 
    backgroundColor: '#1e293b', 
    overflow: 'hidden',
    position: 'relative'
  },
  video: { 
    width: '100%', 
    height: '100%' 
  },
  videoDurationBadge: { 
    position: 'absolute', 
    bottom: 12, 
    right: 12, 
    backgroundColor: 'rgba(0,0,0,0.75)', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  videoDurationText: { 
    color: 'white', 
    fontSize: 12,
    fontWeight: '600'
  },
  
  // AI Results
  aiResultsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(230, 57, 57, 0.3)',
  },
  aiResultsGradient: {
    padding: 16,
  },
  aiResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  aiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(230, 57, 57, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiResultsTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  primaryDetection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  primaryType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  confidenceContainer: {
    flex: 1,
    minWidth: 120,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  confidenceText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  detectionsSection: {
    marginBottom: 16,
  },
  detectionsTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '500',
  },
  detectionsGrid: {
    gap: 8,
  },
  detectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectionName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  detectionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectionConfidence: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: 'bold',
  },
  
  // Location
  locationCard: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginBottom: 16, 
    borderRadius: 20, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  locationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginBottom: 12 
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(230, 57, 57, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTitle: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: 'bold' 
  },
  locationAddress: { 
    color: '#94a3b8', 
    fontSize: 13, 
    marginBottom: 8,
    lineHeight: 18
  },
  locationCoordinates: { 
    color: '#64748b', 
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  locationLoader: { 
    marginVertical: 10 
  },
  locationNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  locationNoteText: { 
    color: '#64748b', 
    fontSize: 11,
    flex: 1
  },
  
  // Input
  inputCard: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginBottom: 16, 
    borderRadius: 20, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  inputHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginBottom: 12 
  },
  inputLabel: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: 'bold' 
  },
  input: { 
    backgroundColor: '#0f172a', 
    borderRadius: 14, 
    padding: 14, 
    color: '#fff', 
    fontSize: 14, 
    minHeight: 100, 
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155'
  },
  inputExpanded: {
    minHeight: 180,
  },
  inputFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 10 
  },
  charCount: { 
    color: '#64748b', 
    fontSize: 11 
  },
  expandText: { 
    color: '#E63939', 
    fontSize: 11,
    fontWeight: '500'
  },
  
  // Suggestions
  suggestionsCard: { 
    marginHorizontal: 20, 
    marginBottom: 20,
  },
  suggestionsTitle: { 
    color: '#94a3b8', 
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '500'
  },
  suggestionsScroll: { 
    flexDirection: 'row',
  },
  suggestionChip: { 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  suggestionText: { 
    color: '#94a3b8', 
    fontSize: 13 
  },
  
  // Submit Button
  submitButton: { 
    marginHorizontal: 20, 
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E63939',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitGradient: { 
    paddingVertical: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10,
  },
  disabledButton: { 
    opacity: 0.6 
  },
  submitText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  
  // Note
  noteContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    marginTop: 5,
    marginBottom: 20,
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  noteText: { 
    color: '#94a3b8', 
    fontSize: 12, 
    flex: 1,
    lineHeight: 18
  },
});