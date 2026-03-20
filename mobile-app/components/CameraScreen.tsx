import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
// 1. useRouter ን ከ expo-router አስገባ
import { useRouter } from 'expo-router'; 

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  
  // 2. router ን Initialize አድርግ
  const router = useRouter(); 

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>ካሜራ ለመጠቀም ፈቃድ ያስፈልጋል</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text>ፈቃድ ስጥ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const options = { quality: 0.5, base64: true };
      const data = await cameraRef.current.takePictureAsync(options);
      setPhoto(data.uri);
    }
  };

  const handleReport = async () => {
    let location = await Location.getCurrentPositionAsync({});
    
    // 3. በ navigation.navigate ፋንታ router.push ተጠቀም
    router.push({
      pathname: '/report-details',
      params: { 
        photoUri: photo, 
        latitude: location.coords.latitude, 
        longitude: location.coords.longitude 
      }
    });
  };

  return (
    <View style={styles.container}>
      {!photo ? (
        <CameraView style={styles.camera} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.innerCircle} />
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => setPhoto(null)} style={styles.retryButton}>
              <Text style={{color: 'white'}}>ድገም</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReport} style={styles.sendButton}>
              <Text style={{color: 'white'}}>ሪፖርት አድርግ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
  buttonContainer: { flex: 1, justifyContent: 'bottom', alignItems: 'center', marginBottom: 50 },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  innerCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'black' },
  previewContainer: { flex: 1 },
  preview: { flex: 1 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: 'black' },
  retryButton: { padding: 15, backgroundColor: 'red', borderRadius: 10 },
  sendButton: { padding: 15, backgroundColor: 'green', borderRadius: 10 }
});