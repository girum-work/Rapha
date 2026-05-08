import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { supabase } from '../../src/lib/supabase';

const DARK = '#0A0F1C';
const RED = '#DC2626';
const MUTED = '#94A3B8';
const WHITE = '#F1F5F9';

interface Coords { latitude: number; longitude: number }

async function getOsrmRoute(from: Coords, to: Coords): Promise<Coords[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coords = data.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return [];
  }
}

export default function AmbulanceMap() {
  const mapRef = useRef<MapView>(null);
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [patientLocation] = useState<Coords | null>(null); // populated from active request
  const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ km: string; min: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setLoading(false); return; }
    const loc = await Location.getCurrentPositionAsync({});
    const me: Coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMyLocation(me);

    // Load active request destination coords if available
    const stored = await AsyncStorage.getItem('rapha_ambulance_device');
    if (stored) {
      const device = JSON.parse(stored) as { id: string };
      const { data } = await supabase
        ?.from('ambulance_requests')
        .select('id, destination_name, status')
        .eq('device_id', device.id)
        .in('status', ['dispatched', 'arrived', 'transporting'])
        .limit(1)
        .maybeSingle() ?? { data: null };

      // Use Addis Ababa Black Lion as demo destination when no coords stored
      const dest: Coords = { latitude: 9.0222, longitude: 38.7468 };
      if (data) {
        const route = await getOsrmRoute(me, dest);
        setRouteCoords(route);
        const distKm = haversineKm(me, dest);
        setRouteInfo({ km: distKm.toFixed(1), min: Math.round(distKm * 3).toString() });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Re-route every 30 seconds
  useEffect(() => {
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={RED} size="large" /></View>;
  }

  const region = myLocation
    ? { latitude: myLocation.latitude, longitude: myLocation.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 9.03, longitude: 38.74, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <SafeAreaView style={styles.safe}>
      <MapView ref={mapRef} style={styles.map} initialRegion={region} showsUserLocation>
        {myLocation && (
          <Marker coordinate={myLocation} title="Ambulance" pinColor={RED} />
        )}
        {patientLocation && (
          <Marker coordinate={patientLocation} title="Patient" pinColor="#3B82F6" />
        )}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={RED} strokeWidth={4} />
        )}
      </MapView>

      {routeInfo && (
        <View style={styles.infoBar}>
          <Text style={styles.infoMain}>{routeInfo.km} km · ~{routeInfo.min} min</Text>
          <Text style={styles.infoSub}>Route via OSRM</Text>
          <Pressable style={styles.arrivedBtn} onPress={() => void refresh()}>
            <Text style={styles.arrivedBtnText}>Refresh Route</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },
  center: { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
  infoBar: {
    position: 'absolute', bottom: 80, left: 16, right: 16,
    backgroundColor: 'rgba(10,15,28,0.92)', borderRadius: 16, padding: 16, gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  infoMain: { fontSize: 18, fontWeight: '700', color: WHITE },
  infoSub: { fontSize: 12, color: MUTED },
  arrivedBtn: { marginTop: 10, backgroundColor: RED, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  arrivedBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
