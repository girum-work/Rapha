import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text className="text-[22px] font-bold text-foreground">Ambulance Profile</Text>

        <View className="bg-card rounded-2xl border border-border p-4 gap-3">
          <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Vehicle Information</Text>
          <Row label="Pairing code"  value={device?.pairing_code ?? '—'} />
          <Row label="Vehicle plate" value={device?.vehicle_plate ?? '—'} />
          <Row label="Hospital"      value={device?.hospital_name ?? '—'} />
        </View>

        <View className="bg-card rounded-2xl border border-border p-4 gap-3">
          <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Driver</Text>
          <Row label="Name"  value={device?.driver_name ?? '—'} />
          <Row label="Phone" value={device?.driver_phone ?? '—'} />
        </View>

        <Pressable
          className="rounded-2xl border border-primary/30 bg-primary/10 py-4 items-center"
          onPress={switchToPatient}
        >
          <Text className="text-primary text-[15px] font-bold">🔄  Switch to Patient Mode</Text>
        </Pressable>

        <Pressable
          className="rounded-2xl border border-destructive/30 bg-destructive/10 py-4 items-center"
          onPress={() => void signOut()}
        >
          <Text className="text-destructive text-[15px] font-bold">Go Offline &amp; Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <Text className="text-[13px] text-foreground font-semibold max-w-[60%] text-right">{value}</Text>
    </View>
  );
}
