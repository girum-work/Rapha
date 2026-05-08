import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../../src/lib/supabase';

const DARK = '#0A0F1C';
const DARK2 = '#111827';
const RED = '#DC2626';
const RED_SOFT = 'rgba(220,38,38,0.12)';
const RED_BORDER = 'rgba(220,38,38,0.3)';
const MUTED = '#94A3B8';
const WHITE = '#F1F5F9';

interface DeviceInfo {
  id: string;
  pairing_code: string;
  vehicle_plate: string | null;
  hospital_name: string | null;
  driver_name: string | null;
}

interface IncomingRequest {
  id: string;
  triage_summary: string | null;
  severity: string | null;
}

export default function AmbulanceHome() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest | null>(null);
  const [countdown, setCountdown] = useState(30);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load device from AsyncStorage
  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem('rapha_ambulance_device');
      if (!stored) { router.replace('/sign-in'); return; }
      const d = JSON.parse(stored) as DeviceInfo;
      setDevice(d);
      setLoading(false);
    })();
  }, [router]);

  // Pulse animation when online
  useEffect(() => {
    if (!isOnline) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isOnline, pulseAnim]);

  // Location heartbeat
  useEffect(() => {
    if (!isOnline || !device) return;
    const ping = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      await supabase?.from('ambulance_device_sessions').insert({
        device_id: device.id,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        last_ping: new Date().toISOString(),
      });
    };
    void ping();
    locationInterval.current = setInterval(() => void ping(), 30_000);
    return () => { if (locationInterval.current) clearInterval(locationInterval.current); };
  }, [isOnline, device]);

  // Realtime subscription for incoming requests
  useEffect(() => {
    if (!device) return;
    const channel = supabase
      ?.channel('ambulance-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ambulance_requests', filter: `device_id=eq.${device.id}` },
        (payload) => setIncoming(payload.new as IncomingRequest),
      )
      .subscribe();
    return () => { void channel?.unsubscribe(); };
  }, [device]);

  // Countdown timer for incoming request
  useEffect(() => {
    if (!incoming) { setCountdown(30); return; }
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void handleDecline(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const toggleOnline = useCallback(async () => {
    if (!device || toggling) return;
    setToggling(true);
    const nextStatus = isOnline ? 'offline' : 'active';
    await supabase?.from('ambulance_devices').update({ status: nextStatus }).eq('id', device.id);
    setIsOnline(!isOnline);
    setToggling(false);
  }, [device, isOnline, toggling]);

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    await supabase
      ?.from('ambulance_requests')
      .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
      .eq('id', incoming.id);
    setIncoming(null);
    router.push('/(ambulance)/duty');
  }, [incoming, router]);

  const handleDecline = useCallback(async () => {
    if (!incoming) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    await supabase?.from('ambulance_requests').update({ status: 'declined' }).eq('id', incoming.id);
    setIncoming(null);
  }, [incoming]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RED} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚑 Rapha Ambulance</Text>
          <Text style={styles.plate}>{device?.vehicle_plate ?? '—'}</Text>
        </View>

        {/* Status card */}
        <View style={[styles.statusCard, isOnline ? styles.statusCardOn : styles.statusCardOff]}>
          <View style={styles.statusCenter}>
            <View style={styles.pulseWrap}>
              <Animated.View
                style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: isOnline ? 0.35 : 0 }]}
              />
              <View style={[styles.statusDot, isOnline ? styles.statusDotOn : styles.statusDotOff]} />
            </View>
            <Text style={styles.statusLabel}>{isOnline ? 'ON DUTY' : 'OFF DUTY'}</Text>
            <Text style={styles.statusSub}>{isOnline ? 'You are visible to dispatch' : 'Go online to receive requests'}</Text>
          </View>
          <Pressable
            style={[styles.toggleBtn, isOnline ? styles.toggleBtnOff : styles.toggleBtnOn]}
            onPress={() => void toggleOnline()}
            disabled={toggling}
          >
            {toggling
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.toggleBtnText}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
            }
          </Pressable>
        </View>

        {/* Device info */}
        <View style={styles.infoCard}>
          <InfoRow label="Hospital" value={device?.hospital_name ?? '—'} />
          <InfoRow label="Driver" value={device?.driver_name ?? '—'} />
          <InfoRow label="Pairing code" value={device?.pairing_code ?? '—'} />
        </View>
      </ScrollView>

      {/* Incoming request overlay */}
      {incoming && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>🚨 EMERGENCY REQUEST</Text>
            <Text style={styles.overlaySeverity}>{(incoming.severity ?? 'CRITICAL').toUpperCase()}</Text>
            <Text style={styles.overlaySummary}>{incoming.triage_summary ?? 'Patient requires immediate assistance'}</Text>
            <Text style={styles.countdown}>Auto-declines in {countdown}s</Text>
            <Pressable style={styles.acceptBtn} onPress={() => void handleAccept()}>
              <Text style={styles.acceptBtnText}>✓  ACCEPT</Text>
            </Pressable>
            <Pressable style={styles.declineBtn} onPress={() => void handleDecline()}>
              <Text style={styles.declineBtnText}>✗  Decline</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },
  center: { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: WHITE },
  plate: { fontSize: 13, color: MUTED, fontWeight: '600' },
  statusCard: { borderRadius: 20, padding: 24, borderWidth: 1, gap: 16 },
  statusCardOn: { backgroundColor: RED_SOFT, borderColor: RED_BORDER },
  statusCardOff: { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.2)' },
  statusCenter: { alignItems: 'center', gap: 8 },
  pulseWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pulseRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: RED },
  statusDot: { width: 52, height: 52, borderRadius: 26 },
  statusDotOn: { backgroundColor: RED },
  statusDotOff: { backgroundColor: '#64748B' },
  statusLabel: { fontSize: 22, fontWeight: '800', color: WHITE, letterSpacing: 2 },
  statusSub: { fontSize: 13, color: MUTED, textAlign: 'center' },
  toggleBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: RED },
  toggleBtnOff: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  toggleBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoCard: { backgroundColor: DARK2, borderRadius: 16, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: MUTED },
  infoValue: { fontSize: 13, color: WHITE, fontWeight: '600' },
  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  overlayCard: { backgroundColor: DARK2, borderRadius: 24, padding: 24, borderWidth: 2, borderColor: RED, gap: 12 },
  overlayTitle: { fontSize: 22, fontWeight: '800', color: WHITE, textAlign: 'center' },
  overlaySeverity: { fontSize: 14, fontWeight: '700', color: RED, textAlign: 'center', letterSpacing: 1.5 },
  overlaySummary: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  countdown: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  acceptBtn: { backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  declineBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  declineBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
});
