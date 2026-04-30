import { Drawer } from 'expo-router/drawer';
import { BookOpen, ClipboardList, History, Home, Settings, ShieldPlus, Stethoscope, UserRound } from 'lucide-react-native';

import { colors } from '../../src/theme';

const iconSize = 19;

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: colors.surface, width: 252 },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textMuted,
        drawerActiveBackgroundColor: colors.primarySoft,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Home',
          drawerIcon: ({ color }) => <Home size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          drawerIcon: ({ color }) => <ClipboardList size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="learn"
        options={{
          title: 'Learn',
          drawerIcon: ({ color }) => <BookOpen size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="accessories"
        options={{
          title: 'Accessories',
          drawerIcon: ({ color }) => <ShieldPlus size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="history"
        options={{
          title: 'History',
          drawerIcon: ({ color }) => <History size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="account"
        options={{
          title: 'Account',
          drawerIcon: ({ color }) => <UserRound size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: 'Settings',
          drawerIcon: ({ color }) => <Settings size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="services"
        options={{
          title: 'Care options',
          drawerIcon: ({ color }) => <Stethoscope size={iconSize} stroke={color} />,
        }}
      />
    </Drawer>
  );
}
