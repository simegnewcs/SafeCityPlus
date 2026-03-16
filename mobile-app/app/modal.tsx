import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SOSModal({ visible, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const captureLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setMediaUri(result.assets[0].uri);
  };

  const sendReport = () => {
    if (!description || !mediaUri) {
      Alert.alert('Error', 'Please add description and media');
      return;
    }
    // TODO: Later send to backend via Axios
    Alert.alert('Success', 'Report sent to authorities! AI classification started.');
    onClose();
    setDescription('');
    setMediaUri(null);
  };

  React.useEffect(() => {
    if (visible) captureLocation();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Report Emergency Now</Text>

          <Text style={styles.label}>Location (Auto-detected)</Text>
          <Text style={styles.locationText}>
            {location ? `Addis Ababa • ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Detecting...'}
          </Text>

          <Text style={styles.label}>Media (Photo/Video)</Text>
          <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
            <Text style={styles.mediaText}>📸 Take / Choose Photo or Video</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="What happened? (fire, accident...)"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity style={styles.sendButton} onPress={sendReport}>
            <Text style={styles.sendText}>SEND REPORT TO AUTHORITIES</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#0A2540' },
  label: { fontWeight: '600', marginTop: 15, color: '#333' },
  locationText: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 10 },
  mediaButton: { backgroundColor: '#0A2540', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  mediaText: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, minHeight: 100, marginBottom: 20 },
  sendButton: { backgroundColor: '#E63939', padding: 18, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeButton: { marginTop: 15, alignItems: 'center' },
  closeText: { color: '#666' },
});