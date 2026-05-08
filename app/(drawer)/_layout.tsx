import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
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
import { Drawer } from 'expo-router/drawer';
import { subscribeProfileRowUpdated } from '../../src/lib/authProfile';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, spacing } from '../../src/theme';

const iconSize = 20;

const ROUTE_META: Record<string, { label: string; Icon: typeof MessageCircle }> = {
  index: { label: 'Dr Lucas    💬', Icon: MessageCircle },
  dashboard: { label: 'Dashboard    📊', Icon: ClipboardList },
  history: { label: 'History    🕐', Icon: History },
  learn: { label: 'Learn    📚', Icon: BookOpen },
  accessories: { label: 'Accessories    ⌚', Icon: Watch },
  services: { label: 'Care Options    🏥', Icon: Stethoscope },
  settings: { label: 'Settings    ⚙️', Icon: Settings },
};

const ROUTE_ORDER = ['index', 'dashboard', 'history', 'learn', 'accessories', 'services', 'settings'];

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

  useEffect(() => {
    return subscribeProfileRowUpdated(() => {
      void loadProfile();
    });
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
      style={styles.drawer}
      contentContainerStyle={styles.drawerContent}
    >
      <View style={styles.profileBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{displayName || 'Guest'}</Text>
        <Text style={styles.email} numberOfLines={2}>
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
                  {label}
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
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(p) => <DrawerContent {...p} />}
      screenOptions={{
        drawerType: 'slide',
        headerShown: false,
        drawerStyle: { backgroundColor: colors.primary, width: 300 },
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="dashboard" />
      <Drawer.Screen name="history" />
      <Drawer.Screen name="learn" />
      <Drawer.Screen name="accessories" />
      <Drawer.Screen name="services" />
      <Drawer.Screen name="settings" />
      <Drawer.Screen name="lesson" />
      <Drawer.Screen name="account" />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: { backgroundColor: colors.primary },
  drawerContent: { flexGrow: 1, paddingTop: 60, paddingBottom: spacing.lg },
  profileBlock: { paddingHorizontal: spacing.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnAccent, fontSize: 22, fontWeight: '700' },
  name: { color: colors.onDark, fontSize: 17, fontWeight: '700', marginTop: spacing.md },
  email: { color: colors.textTertiary, fontSize: 13, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.primaryMid, marginVertical: spacing.lg },
  navBlock: { paddingRight: spacing.sm },
  navItem: {
    height: 52,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.primaryMid,
    borderLeftColor: colors.accent,
  },
  navItemPressed: { opacity: 0.85 },
  navLabel: {
    color: colors.onDark,
    fontSize: 15,
    marginLeft: spacing.md,
  },
  navLabelActive: {
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  footerLine: { color: '#475569', fontSize: 12, fontWeight: '600' },
  footerSub: { color: '#475569', fontSize: 12, marginTop: spacing.xs },
});
