import { Tabs } from 'expo-router';
import { ClipboardList, Home, Map, User } from 'lucide-react-native';

const RED = '#DC2626';
const MUTED = '#64748B';
const DARK = '#0A0F1C';

export default function AmbulanceLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DARK,
          borderTopColor: 'rgba(220,38,38,0.2)',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: RED,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="duty"
        options={{ title: 'Duty', tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarIcon: ({ color }) => <Map size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }}
      />
    </Tabs>
  );
}
