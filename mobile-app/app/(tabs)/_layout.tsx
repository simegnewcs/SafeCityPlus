import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E63939', // Emergency Red
        tabBarInactiveTintColor: '#393ce6',
        headerShown: false, // በየገጹ ሄደር ስላለ እዚህ ባይኖር ይሻላል
        tabBarStyle: { 
          backgroundColor: '#45c966', // Deep Navy
          borderTopWidth: 1,
          borderTopColor: '#1e293b',
          // ቁመቱን በስልኩ አይነት እና በታቦቹ ብዛት መሰረት እናስተካክላለን
          height: Platform.OS === 'ios' ? 88 : 75 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10, // 6 ታብ ስለሆነ ትንሽ አነስ ቢል ይሻላል
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} /> 
        }} 
      />
      
      <Tabs.Screen 
        name="reports" 
        options={{ 
          title: 'My reports', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "shield-checkmark" : "shield-outline"} size={22} color={color} /> 
        }} 
      />
      
      <Tabs.Screen 
        name="map" 
        options={{ 
          title: 'Map', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "map" : "map-outline"} size={22} color={color} /> 
        }} 
      />

      <Tabs.Screen 
        name="cctv" 
        options={{ 
          title: 'CCTV', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "videocam" : "videocam-outline"} size={22} color={color} /> 
        }} 
      />

      <Tabs.Screen 
        name="tips" 
        options={{ 
          title: 'Tips', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "bulb" : "bulb-outline"} size={22} color={color} /> 
        }} 
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} /> 
        }} 
      />
    </Tabs>
  );
}