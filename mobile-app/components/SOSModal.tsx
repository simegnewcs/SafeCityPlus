// app/components/SOSModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { storage } from '../../utils/storage'; // Import our custom storage
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SOSModal({ visible, onClose }: SOSModalProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const scaleAnim = useState(new Animated.Value(0))[0];

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  const handleGuestMode = async () => {
    setLoading(true);
    try {
      // Set guest session using our storage
      await storage.setItem('userRole', 'Guest');
      await storage.setItem('isGuest', 'true');
      await storage.setItem('sessionId', `guest_${Date.now()}`);
      
      onClose();
      // Navigate to emergency report page with guest mode
      router.push({
        pathname: '/emergency-report',
        params: { mode: 'guest' }
      });
    } catch (error) {
      console.error('Guest mode error:', error);
      Alert.alert('Error', 'Failed to start guest session');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    onClose();
    router.push('/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={90} style={styles.modalContainer}>
        <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#E63939', '#B91C1C']}
            style={styles.sosHeader}
          >
            <Text style={styles.sosEmoji}>🚨</Text>
            <Text style={styles.sosTitle}>EMERGENCY</Text>
            <Text style={styles.sosSubtitle}>Immediate assistance required</Text>
          </LinearGradient>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.optionButton, styles.guestButton]}
              onPress={handleGuestMode}
              disabled={loading}
            >
              <LinearGradient
                colors={['#1E3A5F', '#0A2540']}
                style={styles.optionGradient}
              >
                <Text style={styles.optionEmoji}>👤</Text>
                <Text style={styles.optionTitle}>Guest Mode</Text>
                <Text style={styles.optionDescription}>
                  Report emergency without login
                </Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>• Upload photos</Text>
                  <Text style={styles.featureItem}>• Live video streaming</Text>
                  <Text style={styles.featureItem}>• Real-time AI analysis</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionButton, styles.loginButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={['#2D4A6F', '#1E3A5F']}
                style={styles.optionGradient}
              >
                <Text style={styles.optionEmoji}>🔐</Text>
                <Text style={styles.optionTitle}>Login</Text>
                <Text style={styles.optionDescription}>
                  Access your account for full features
                </Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>• Track your reports</Text>
                  <Text style={styles.featureItem}>• Responder features</Text>
                  <Text style={styles.featureItem}>• Admin dashboard</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#0A2540',
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  sosHeader: {
    padding: 30,
    alignItems: 'center',
  },
  sosEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  sosTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  sosSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 5,
  },
  optionsContainer: {
    padding: 20,
    gap: 15,
  },
  optionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  guestButton: {
    transform: [{ scale: 1 }],
  },
  loginButton: {
    transform: [{ scale: 1 }],
  },
  optionGradient: {
    padding: 25,
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  optionDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 15,
  },
  featureList: {
    alignItems: 'flex-start',
    width: '100%',
  },
  featureItem: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 5,
    opacity: 0.9,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});