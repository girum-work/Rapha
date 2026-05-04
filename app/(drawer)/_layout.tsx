import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import {
  BookOpen,
  ClipboardList,
  History,
  MessageCircle,
  Settings,
  Stethoscope,
  Watch,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, spacing } from '../../src/theme';

const iconSize = 20;

const ROUTE_META: Record<
  string,
  { label: string; Icon: typeof MessageCircle }
> = {
  index: { label: 'Dr Lucas', Icon: MessageCircle },
  dashboard: { label: 'Dashboard', Icon: ClipboardList },
  history: { label: 'History', Icon: History },
  learn: { label: 'Learn', Icon: BookOpen },
  accessories: { label: 'Accessories', Icon: Watch },
  services: { label: 'Care Options', Icon: Stethoscope },
  settings: { label: 'Settings', Icon: Settings },
};

/** Preferred drawer order (routes omitted fall back to navigation order). */
const ROUTE_ORDER = [
  'index',
  'dashboard',
  'history',
  'learn',
  'accessories',
  'services',
  'settings',
];

function DrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const loadProfile = useCallback(async () => {
    if (!hasSupabaseConfig || !supabase) {
      setDisplayName('Guest');
      setEmail('');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;
    const em = u?.email ?? '';
    setEmail(em);
    if (!u?.id) {
      setDisplayName(em ? em.split('@')[0] : 'Guest');
      return;
    }
    const { data } = await supabase.from('profiles').select('display_name').eq('id', u.id).maybeSingle();
    const name = (data?.display_name as string | null)?.trim();
    setDisplayName(name || (em ? em.split('@')[0] : 'Guest'));
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const initial = useMemo(() => {
    const s = displayName.trim() || email.trim() || '?';
    return s.charAt(0).toUpperCase();
  }, [displayName, email]);

  const sortedRoutes = useMemo(() => {
    const routes = [...state.routes];
    routes.sort((a, b) => {
      const ia = ROUTE_ORDER.indexOf(a.name);
      const ib = ROUTE_ORDER.indexOf(b.name);
      const sa = ia === -1 ? 999 : ia;
      const sb = ib === -1 ? 999 : ib;
      return sa - sb;
    });
    return routes;
  }, [state.routes]);

  const activeRouteName = state.routes[state.index]?.name;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerScroll}
      style={styles.drawerScrollView}
    >
      <View style={styles.drawerInner}>
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.profileName}>{displayName || 'Guest'}</Text>
          <Text style={styles.profileEmail} numberOfLines={2}>
            {email || ' '}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.navBlock}>
          {sortedRoutes
            .filter((route) => route.name !== 'account' && route.name !== 'lesson')
            .map((route) => {
            const focused = activeRouteName === route.name;
            const meta = ROUTE_META[route.name];
            if (!meta) return null;
            const { Icon, label } = meta;
            const labelWithEmoji =
              route.name === 'index'
                ? `${label}    💬`
                : route.name === 'dashboard'
                  ? `${label}    📊`
                  : route.name === 'history'
                    ? `${label}    🕐`
                    : route.name === 'learn'
                      ? `${label}    📚`
                      : route.name === 'accessories'
                        ? `${label}    ⌚`
                        : route.name === 'services'
                          ? `${label}    🏥`
                          : route.name === 'settings'
                            ? `${label}    ⚙️`
                            : label;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                onPress={() => {
                  const event = navigation.emit({
                    type: 'drawerItemPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={({ pressed }) => [
                  styles.navItem,
                  focused && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
              >
                <Icon size={iconSize} color={focused ? colors.accent : colors.textTertiary} strokeWidth={2} />
                <Text style={[styles.navLabel, focused && styles.navLabelActive]} numberOfLines={1}>
                  {labelWithEmoji}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Text style={styles.footerLine}>Rapha v1.0</Text>
          <Text style={styles.footerSub}>Ethiopia · MVP</Text>
        </View>
      </View>
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(p) => <DrawerContent {...p} />}
      screenOptions={{
        drawerType: 'slide',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
        drawerStyle: { backgroundColor: colors.primary, width: 300 },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Dr Lucas',
          headerShown: false,
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
        name="history"
        options={{
          title: 'History',
          drawerIcon: ({ color }) => <History size={iconSize} stroke={color} />,
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
          drawerIcon: ({ color }) => <Watch size={iconSize} stroke={color} />,
        }}
      />
      <Drawer.Screen
        name="services"
        options={{
          title: 'Care options',
          drawerIcon: ({ color }) => <Stethoscope size={iconSize} stroke={color} />,
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
        name="lesson"
        options={{
          title: 'Lesson',
          headerShown: false,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerScrollView: {
    backgroundColor: colors.primary,
  },
  drawerScroll: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },
  drawerInner: {
    flex: 1,
    minHeight: '100%',
  },
  profileBlock: {
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.surface,
  },
  profileEmail: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.primaryMid,
    marginBottom: 24,
    marginHorizontal: 0,
  },
  navBlock: {
    gap: 0,
  },
  navItem: {
    height: 52,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.primaryMid,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  navItemPressed: {
    opacity: 0.92,
  },
  navLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.surface,
    fontWeight: '400',
  },
  navLabelActive: {
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
  footerLine: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  footerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
  },
});
