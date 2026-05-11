import 'react-native-gesture-handler';

import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { ToastProvider } from '../src/context/ToastContext';
import { subscribeProfileRowUpdated } from '../src/lib/authProfile';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, fonts } from '../src/theme';
import '../global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AUTH_BOOT_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

function AuthLoadingScreen({ serifReady }: { serifReady: boolean }) {
  return (
    <View style={styles.loadingRoot} pointerEvents="auto">
      <Text style={[styles.loadingTitle, serifReady ? styles.loadingTitleSerif : null]}>Rapha</Text>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

/** Session 15: handles notification tap → in-app route from `data.url` (push deep links). */
export function DrawerNotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    function openFromData(data: Record<string, unknown> | undefined) {
      const url = data?.url;
      if (typeof url === 'string' && url.length > 0) {
        router.push(url as Href);
      }
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openFromData(response.notification.request.content.data as Record<string, unknown> | undefined);
        }
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromData(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  /** Single `loadAsync` — two separate `useFonts` hooks raced `expo-font` and could hang or error on Android. */
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsReady = fontsLoaded || fontError != null;
  const serifReady = fontsLoaded && fontError == null;

  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  const syncProfileRow = useCallback(async (sess: Session | null) => {
    if (!supabase || !sess?.user?.id) {
      setHasProfile(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('id', sess.user.id).maybeSingle();
      if (error) {
        setHasProfile(false);
        return;
      }
      setHasProfile(!!data);
    } catch {
      setHasProfile(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasSupabaseConfig || !supabase) {
      setSession(null);
      setHasProfile(false);
      setBootstrapDone(true);
      return;
    }

    async function boot() {
      const fallback = { data: { session: null as Session | null } };
      const { data } = await withTimeout(supabase!.auth.getSession(), AUTH_BOOT_TIMEOUT_MS, fallback);
      if (cancelled) return;
      const initial = data.session ?? null;
      setSession(initial);
      await syncProfileRow(initial);
      if (!cancelled) setBootstrapDone(true);
    }

    void boot();

    const { data } = supabase!.auth.onAuthStateChange((evt: AuthChangeEvent, nextSession) => {
      if (cancelled) return;

      if (evt === 'TOKEN_REFRESHED') {
        setSession(nextSession ?? null);
        return;
      }

      setSession(nextSession ?? null);
      void syncProfileRow(nextSession);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [syncProfileRow]);

  useEffect(() => {
    return subscribeProfileRowUpdated(() => {
      void (async () => {
        if (!supabase) return;
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        setSession(s);
        await syncProfileRow(s);
      })();
    });
  }, [syncProfileRow]);

  useEffect(() => {
    if (!fontsReady) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);

  useEffect(() => {
    if (!bootstrapDone) return;
    if (!fontsReady) return;
    if (!navigationState?.key) return;

    const first = segments[0];
    if (first === undefined || first === null) return;

    const inPublicAuth = first === 'sign-in' || first === 'sign-up' || first === 'verify-otp';

    if (!session) {
      if (first === 'onboarding') {
        router.replace('/sign-in');
        return;
      }
      if (!inPublicAuth) {
        router.replace('/sign-in');
      }
      return;
    }

    if (!hasProfile) {
      if (first !== 'onboarding') {
        router.replace('/onboarding');
      }
      return;
    }

    if (hasProfile && (inPublicAuth || first === 'onboarding')) {
      router.replace('/(drawer)/dashboard');
      return;
    }

    // Keep patient app on drawer navigation for now.
    if (hasProfile && first === '(ambulance)') {
      router.replace('/(drawer)/dashboard');
    }
  }, [bootstrapDone, fontsReady, navigationState?.key, router, segments, session, hasProfile]);

  const showAuthLoadingOverlay = useMemo(() => !bootstrapDone || !fontsReady, [bootstrapDone, fontsReady]);

  return (
    <ToastProvider>
      <ScreenErrorBoundary>
        <>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
            <Stack.Screen name="sign-up" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="verify-otp" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="(drawer)" options={{ animation: 'none' }} />
            <Stack.Screen name="(ambulance)" options={{ animation: 'fade' }} />
          </Stack>

          <DrawerNotificationBridge />

          <StatusBar style="dark" />
          {showAuthLoadingOverlay ? (
            <View style={styles.loadingOverlay}>
              <AuthLoadingScreen serifReady={serifReady} />
            </View>
          ) : null}
        </>
      </ScreenErrorBoundary>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingTitle: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  loadingTitleSerif: {
    fontFamily: fonts.display,
    fontWeight: '500',
  },
});
