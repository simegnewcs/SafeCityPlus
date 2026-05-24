import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const RING_SIZE = 140;
const LOGO_SIZE = 104;

interface AppLoaderProps {
  message?: string;
}

export default function AppLoader({ message }: AppLoaderProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    // Fade in whole component
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();

    // Continuous spin of the ring
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
    ).start();

    // Subtle logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.96, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={['#0f172a', '#111827', '#0f172a']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        {/* Spinning ring + circular logo */}
        <View style={styles.ringWrap}>

          {/* Spinning arc ring */}
          <Animated.View style={[styles.spinRing, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={['#E63939', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.arcGradient}
            />
          </Animated.View>

          {/* Static dim track ring */}
          <View style={styles.trackRing} />

          {/* Circular logo — overflow:hidden clips white background */}
          <Animated.View style={[styles.logoCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Image
              source={require('../assets/images/safecityplus.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </Animated.View>

        </View>

        {/* Brand */}
        <Text style={styles.brand}>
          SafeCity<Text style={styles.brandPlus}>+</Text>
        </Text>
        <Text style={styles.tagline}>Emergency Response System</Text>

        {/* Message */}
        {message ? <Text style={styles.message}>{message}</Text> : null}

      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 10,
  },

  // Outer wrapper that holds ring + logo centered
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  // Dim static track (full circle outline)
  trackRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // Spinning arc — uses borderRadius + border with only one colored side
  spinRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderTopColor: '#E63939',
    borderRightColor: 'rgba(230,57,57,0.4)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },

  arcGradient: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },

  // Circular logo — overflow hidden to clip the white background of the PNG
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    shadowColor: '#E63939',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  brand: {
    color: '#f1f5f9',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandPlus: {
    color: '#E63939',
  },
  tagline: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  message: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '500',
  },
});
