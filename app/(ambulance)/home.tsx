import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { supabase } from '../../src/lib/supabase';

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

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem('rapha_ambulance_device');
      if (!stored) { router.replace('/sign-in'); return; }
      const d = JSON.parse(stored) as DeviceInfo;
      setDevice(d);
      setLoading(false);
    })();
  }, [router]);

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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#DC2626" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-[20px] font-bold text-foreground">🚑 Rapha Ambulance</Text>
          <Text className="text-[13px] font-semibold text-muted-foreground">{device?.vehicle_plate ?? '—'}</Text>
        </View>

        {/* Status card */}
        <View
          className="rounded-[20px] p-6 border gap-4"
          style={{
            backgroundColor: isOnline ? 'rgba(220,38,38,0.12)' : 'rgba(100,116,139,0.1)',
            borderColor: isOnline ? 'rgba(220,38,38,0.3)' : 'rgba(100,116,139,0.2)',
          }}
        >
          <View className="items-center gap-2">
            <View className="w-[72px] h-[72px] items-center justify-center mb-1">
              <MotiView
                style={{ position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: '#DC2626', opacity: isOnline ? 0.35 : 0 }}
                from={{ scale: 1 }}
                animate={isOnline ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={isOnline ? { type: 'timing', duration: 1800, loop: true } : { type: 'timing', duration: 150 }}
              />
              <View
                className="w-[52px] h-[52px] rounded-full"
                style={{ backgroundColor: isOnline ? '#DC2626' : '#64748B' }}
              />
            </View>
            <Text className="text-[22px] font-black text-foreground tracking-[2px]">
              {isOnline ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
            <Text className="text-[13px] text-muted-foreground text-center">
              {isOnline ? 'You are visible to dispatch' : 'Go online to receive requests'}
            </Text>
          </View>
          <Pressable
            className="rounded-xl py-[14px] items-center"
            style={{ backgroundColor: isOnline ? '#DC2626' : '#1F2937', borderWidth: isOnline ? 0 : 1, borderColor: '#374151' }}
            onPress={() => void toggleOnline()}
            disabled={toggling}
          >
            {toggling
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text className="text-white text-[15px] font-bold">{isOnline ? 'Go Offline' : 'Go Online'}</Text>
            }
          </Pressable>
        </View>

        {/* Device info */}
        <View className="bg-card rounded-2xl border border-border p-4 gap-3">
          <InfoRow label="Hospital"     value={device?.hospital_name ?? '—'} />
          <InfoRow label="Driver"       value={device?.driver_name ?? '—'} />
          <InfoRow label="Pairing code" value={device?.pairing_code ?? '—'} />
        </View>
      </ScrollView>

      {/* Incoming request overlay */}
      {incoming && (
        <View className="absolute inset-0 items-center justify-center p-5" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View className="bg-card rounded-3xl p-6 border-2 border-destructive gap-3 w-full">
            <Text className="text-[22px] font-black text-foreground text-center">🚨 EMERGENCY REQUEST</Text>
            <Text className="text-[14px] font-bold text-destructive text-center tracking-[1.5px]">
              {(incoming.severity ?? 'CRITICAL').toUpperCase()}
            </Text>
            <Text className="text-[14px] text-muted-foreground text-center leading-5">
              {incoming.triage_summary ?? 'Patient requires immediate assistance'}
            </Text>
            <Text className="text-[12px] text-muted-foreground text-center">Auto-declines in {countdown}s</Text>
            <Pressable
              className="rounded-2xl py-[18px] items-center"
              style={{ backgroundColor: '#16A34A' }}
              onPress={() => void handleAccept()}
            >
              <Text className="text-white text-[18px] font-black tracking-[0.5px]">✓  ACCEPT</Text>
            </Pressable>
            <Pressable
              className="rounded-2xl py-[14px] items-center border border-[#374151]"
              onPress={() => void handleDecline()}
            >
              <Text className="text-muted-foreground text-[14px] font-semibold">✗  Decline</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <Text className="text-[13px] text-foreground font-semibold">{value}</Text>
    </View>
  );
}
