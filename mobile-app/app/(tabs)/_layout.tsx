import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E63939',
        tabBarInactiveTintColor: '#64748b',
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#0f172a',
          borderTopWidth: 1,
          borderTopColor: '#1e293b',
          height: Platform.OS === 'ios' ? 88 : 70 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ) 
        }} 
      />
      
      <Tabs.Screen 
        name="map" 
        options={{ 
          title: 'Map', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={22} color={color} />
          ) 
        }} 
      />
      
      <Tabs.Screen 
        name="reports" 
        options={{ 
          title: 'Reports', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "shield-checkmark" : "shield-outline"} size={22} color={color} />
          ) 
        }} 
      />

      {/* NEW EMERGENCY TAB */}
      <Tabs.Screen 
        name="emergency" 
        options={{ 
          title: 'Emergency', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "alert-circle" : "alert-circle-outline"} size={22} color={color} />
          ) 
        }} 
      />

      <Tabs.Screen 
        name="cctv" 
        options={{ 
          title: 'CCTV', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "videocam" : "videocam-outline"} size={22} color={color} />
          ) 
        }} 
      />

      <Tabs.Screen 
        name="tips" 
        options={{ 
          title: 'Tips', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bulb" : "bulb-outline"} size={22} color={color} />
          ) 
        }} 
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ) 
        }} 
      />
    </Tabs>
  );
}