import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E63939',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: { backgroundColor: '#0A2540' },
        headerStyle: { backgroundColor: '#0A2540' },
        headerTintColor: '#fff',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'My Reports', tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} /> }} />
      <Tabs.Screen name="cctv" options={{ title: 'CCTV Feed', tabBarIcon: ({ color }) => <Ionicons name="videocam" size={24} color={color} /> }} />
      <Tabs.Screen name="tips" options={{ title: 'Tips', tabBarIcon: ({ color }) => <Ionicons name="bulb" size={24} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }} />
    </Tabs>
  );
}