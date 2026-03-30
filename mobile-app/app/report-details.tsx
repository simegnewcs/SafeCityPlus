import React, { useState, useEffect } from 'react';
import { 
  View, Text, Image, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  Platform, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { reportIncident } from '../services/incidentService';

const { width } = Dimensions.get('window');

export default function ReportDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Get params from navigation
  const photoUri = params.photoUri as string;
  const latitude = params.latitude as string;
  const longitude = params.longitude as string;
  const mediaType = (params.mediaType as string) || 'image';
  const videoDuration = params.videoDuration ? parseInt(params.videoDuration as string) : 0;
  const detectedObjects = params.detectedObjects ? JSON.parse(params.detectedObjects as string) : [];
  
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<any>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("ማሳሰቢያ", "እባክዎ ስለ አደጋው አጭር መግለጫ ይጻፉ");
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
      
      Alert.alert(
        "ተሳክቷል!", 
        `ሪፖርቱ በስኬት ተልኳል!\n\nAI ማወቂያ: ${result.ai_analysis?.primary_incident?.type || 'Unknown'}\nቅድሚያ: ${result.ai_analysis?.primary_incident?.priority || 'Normal'}`,
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
      console.error(error);
      Alert.alert(
        "ስህተት", 
        error.response?.data?.message || "ሪፖርቱን መላክ አልተቻለም። እባክዎ ደግመው ይሞክሩ።"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
        </View>

        {/* Media Preview */}
        <View style={styles.mediaContainer}>
          {mediaType === 'video' ? (
            <View style={styles.videoContainer}>
              <Video
                source={{ uri: photoUri }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
                isLooping
                shouldPlay
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

        {/* AI Detection Results */}
        {detectedObjects.length > 0 && (
          <View style={styles.detectionCard}>
            <View style={styles.detectionHeader}>
              <Ionicons name="scan-outline" size={20} color="#E63939" />
              <Text style={styles.detectionTitle}>AI Detection Results</Text>
            </View>
            <View style={styles.detectionList}>
              {detectedObjects.map((obj: string, index: number) => (
                <View key={index} style={styles.detectionItem}>
                  <Ionicons name="warning-outline" size={14} color="#E63939" />
                  <Text style={styles.detectionText}>{obj}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Location Info */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#E63939" />
            <Text style={styles.locationTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>
            ኬክሮስ (Lat): {parseFloat(latitude).toFixed(6)}, ኬንትሮስ (Lng): {parseFloat(longitude).toFixed(6)}
          </Text>
          <View style={styles.locationNote}>
            <Ionicons name="information-circle-outline" size={12} color="#64748b" />
            <Text style={styles.locationNoteText}>ይህ ቦታ ለአደጋ ምላሽ ሰጪ ቡድን ይላካል</Text>
          </View>
        </View>

        {/* Description Input */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>የአደጋው መግለጫ</Text>
          <TextInput
            style={styles.input}
            placeholder="ምን ተከሰተ? (ለምሳሌ፡ ከባድ የመኪና አደጋ፣ እሳት፣ ወዘተ...)"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, isUploading && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitText}>ሪፖርት ላክ</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Note */}
        <View style={styles.noteContainer}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#3b82f6" />
          <Text style={styles.noteText}>
            ሪፖርትዎ በአይ-ኤ ቴክኖሎጂ ይተነተናል እና ለሚመለከተው አካል በፍጥነት ይደርሳል
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: 'transparent'
  },
  backButton: { 
    padding: 8, 
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  
  mediaContainer: { 
    alignItems: 'center', 
    marginBottom: 20,
    paddingHorizontal: 20
  },
  image: { 
    width: width - 40, 
    height: 250, 
    borderRadius: 20, 
    backgroundColor: '#1e293b' 
  },
  videoContainer: { 
    width: width - 40, 
    height: 250, 
    borderRadius: 20, 
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
    bottom: 10, 
    right: 10, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  videoDurationText: { 
    color: 'white', 
    fontSize: 10,
    fontWeight: '500'
  },
  
  detectionCard: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginBottom: 15, 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  detectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 12 
  },
  detectionTitle: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  detectionList: { 
    gap: 8 
  },
  detectionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  detectionText: { 
    color: '#E63939', 
    fontSize: 12,
    fontWeight: '500'
  },
  
  locationCard: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginBottom: 15, 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  locationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 10 
  },
  locationTitle: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  locationText: { 
    color: '#94a3b8', 
    fontSize: 12, 
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  locationNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  locationNoteText: { 
    color: '#64748b', 
    fontSize: 10,
    flex: 1
  },
  
  inputCard: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, 
    marginBottom: 20, 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  inputLabel: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 'bold', 
    marginBottom: 12 
  },
  input: { 
    backgroundColor: '#0f172a', 
    borderRadius: 12, 
    padding: 14, 
    color: '#fff', 
    fontSize: 14, 
    minHeight: 100, 
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155'
  },
  charCount: { 
    color: '#64748b', 
    fontSize: 10, 
    textAlign: 'right', 
    marginTop: 8 
  },
  
  submitButton: { 
    backgroundColor: '#E63939', 
    marginHorizontal: 20, 
    padding: 16, 
    borderRadius: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10,
    marginBottom: 20
  },
  disabledButton: { 
    opacity: 0.6 
  },
  submitText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  
  noteContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    marginTop: 5,
    marginBottom: 20,
    gap: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    padding: 12,
    borderRadius: 12
  },
  noteText: { 
    color: '#94a3b8', 
    fontSize: 11, 
    flex: 1,
    lineHeight: 16
  }
});