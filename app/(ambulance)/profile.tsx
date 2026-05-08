import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

const DARK = '#0A0F1C';
const DARK2 = '#111827';
const RED = '#DC2626';
const TEAL = '#00C2A8';
const MUTED = '#94A3B8';
const WHITE = '#F1F5F9';

interface DeviceInfo {
  id: string; pairing_code: string; vehicle_plate: string | null;
  hospital_name: string | null; driver_name: string | null; driver_phone: string | null;
}

export default function AmbulanceProfile() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('rapha_ambulance_device').then((s) => {
      if (s) setDevice(JSON.parse(s) as DeviceInfo);
    });
  }, []);

  const signOut = async () => {
    await supabase?.from('ambulance_devices').update({ status: 'offline' }).eq('id', device?.id ?? '');
    await AsyncStorage.multiRemove(['rapha_ambulance_device', 'rapha_mode']);
    router.replace('/sign-in');
  };

  const switchToPatient = async () => {
    await AsyncStorage.removeItem('rapha_mode');
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Ambulance Profile</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Vehicle Information</Text>
          <Row label="Pairing code"   value={device?.pairing_code ?? '—'} />
          <Row label="Vehicle plate"  value={device?.vehicle_plate ?? '—'} />
          <Row label="Hospital"       value={device?.hospital_name ?? '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Driver</Text>
          <Row label="Name"  value={device?.driver_name ?? '—'} />
          <Row label="Phone" value={device?.driver_phone ?? '—'} />
        </View>

        <Pressable style={styles.switchBtn} onPress={switchToPatient}>
          <Text style={styles.switchBtnText}>🔄  Switch to Patient Mode</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={() => void signOut()}>
          <Text style={styles.signOutBtnText}>Go Offline &amp; Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },
  scroll: { padding: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: WHITE },
  card: { backgroundColor: DARK2, borderRadius: 16, padding: 16, gap: 12 },
  sectionLabel: { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: MUTED },
  rowValue: { fontSize: 13, color: WHITE, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  switchBtn: { backgroundColor: 'rgba(0,194,168,0.12)', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,194,168,0.3)' },
  switchBtnText: { color: TEAL, fontSize: 15, fontWeight: '700' },
  signOutBtn: { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  signOutBtnText: { color: RED, fontSize: 15, fontWeight: '700' },
});
