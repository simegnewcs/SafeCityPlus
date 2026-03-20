import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { reportIncident } from '../services/incidentService'; // ቅድም የሰራነው ሰርቪስ

export default function ReportDetails() {
  const { photoUri, latitude, longitude } = useLocalSearchParams();
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!description) {
      Alert.alert("ማሳሰቢያ", "እባክዎ ስለ አደጋው አጭር መግለጫ ይጻፉ");
      return;
    }

    setIsUploading(true);
    try {
      // ፎቶውን፣ ቦታውን እና መግለጫውን ወደ ባክ-ኤንድ መላክ
      const location = { coords: { latitude: parseFloat(latitude as string), longitude: parseFloat(longitude as string) } };
      await reportIncident(photoUri as string, location, description);
      
      Alert.alert("ተሳክቷል!", "ሪፖርቱ ለሚመለከተው አካል ተልኳል።", [
        { text: "እሺ", onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("ስህተት", "ሪፖርቱን መላክ አልተቻለም። እባክዎ ደግመው ይሞክሩ።");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: photoUri as string }} style={styles.previewImage} />
      
      <View style={styles.form}>
        <Text style={styles.label}>የአደጋው መግለጫ (Description)</Text>
        <TextInput
          style={styles.input}
          placeholder="ምን ተከሰተ? (ለምሳሌ፡ ከባድ የመኪና አደጋ...)"
          placeholderTextColor="#94a3b8"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity 
          style={[styles.submitButton, isUploading && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>ሪፖርት ላክ</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540' },
  previewImage: { width: '100%', height: 300, resizeMode: 'cover' },
  form: { padding: 20 },
  label: { color: '#fff', fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
  input: { 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 10, 
    padding: 15, 
    color: '#fff', 
    height: 100, 
    textAlignVertical: 'top' 
  },
  submitButton: { 
    backgroundColor: '#E63939', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 20 
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});