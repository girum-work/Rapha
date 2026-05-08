import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Ambulance, Car, ChevronRight, MapPin, Navigation, Paperclip, Phone, User } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ADDIS_CENTER } from '../../src/data/facilities';
import { matchPharmacies, rankFacilities } from '../../src/lib/facilitySearch';
import { getOrCreateSession } from '../../src/lib/sessionStore';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Facility, Pharmacy, PharmacyStock } from '../../src/types';

const DEFAULT_LOCATION_LABEL = 'Addis Ababa, Ethiopia';

const RECOMMENDED_DRUGS = ['paracetamol', 'oral rehydration salts', 'amoxicillin', 'cetirizine'];

function distKm(lat: number, lon: number, f: Facility): number {
  const R = 6371;
  const dLat = ((f.latitude - lat) * Math.PI) / 180;
  const dLon = ((f.longitude - lon) * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const la2 = (f.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ action?: string; conditionName?: string }>();
  const action = (params.action as string) ?? 'default';
  const conditionName = typeof params.conditionName === 'string' ? params.conditionName : null;

  const [uploaded, setUploaded] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION_LABEL);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [dbFacilities, setDbFacilities] = useState<Facility[]>([]);
  const [navTarget, setNavTarget] = useState<Facility | Pharmacy | null>(null);
  const [navPlaceLabel, setNavPlaceLabel] = useState<string | null>(null);
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const loc = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setLocationLabel(`${loc.coords.latitude.toFixed(3)}°, ${loc.coords.longitude.toFixed(3)}°`);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!navTarget) {
      setNavPlaceLabel(null);
      setNavLoading(false);
      return;
    }
    let cancelled = false;
    setNavLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${navTarget.latitude}&lon=${navTarget.longitude}`,
          { headers: { 'User-Agent': 'RaphaHealthApp/1.0' } },
        );
        const j = (await res.json()) as { display_name?: string };
        if (!cancelled) setNavPlaceLabel(j.display_name ?? null);
      } catch {
        if (!cancelled) setNavPlaceLabel(null);
      } finally {
        if (!cancelled) setNavLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navTarget]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, type, address, neighborhood, phone, latitude, longitude, capability_tags');
      if (cancelled || error || !data) return;
      const mapped: Facility[] = data.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        type: r.type as Facility['type'],
        address: r.address as string,
        neighborhood: r.neighborhood as string,
        phone: (r.phone as string) ?? '',
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        capabilityTags: (r.capability_tags as string[]) ?? [],
      }));
      setDbFacilities(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const header = useMemo(() => {
    if (action === 'emergency')
      return { bg: colors.emergency, title: '🚨 Emergency Care', sub: 'Find immediate help nearby' };
    if (action === 'hospital')
      return {
        bg: colors.urgent,
        title: '🏥 Find Care',
        sub: conditionName ? `${conditionName} needs attention` : 'Find hospital care nearby',
      };
    if (action === 'clinic')
      return {
        bg: colors.urgent,
        title: '🏥 Find Care',
        sub: conditionName ? `${conditionName} needs attention` : 'Find clinic care nearby',
      };
    if (action === 'pharmacy')
      return { bg: colors.mild, title: '💊 Pharmacy', sub: 'Find your medications nearby' };
    return { bg: colors.primary, title: 'Care Options', sub: 'Find hospitals, clinics, and pharmacies' };
  }, [action, conditionName]);

  const facilityList: Facility[] = useMemo(() => {
    const hasTag = (f: Facility, tags: string[]) => tags.some((t) => f.capabilityTags.includes(t));

    let list: Facility[] = [];
    if (dbFacilities.length > 0) {
      if (action === 'emergency') list = dbFacilities.filter((f) => hasTag(f, ['emergency']));
      else if (action === 'hospital')
        list = dbFacilities.filter((f) => hasTag(f, ['emergency', 'general', 'surgery']));
      else if (action === 'clinic') {
        const cand = dbFacilities.filter((f) => hasTag(f, ['general', 'pediatrics']) || f.type === 'clinic');
        list = cand.length > 0 ? cand : dbFacilities.slice(0, 6);
      } else list = dbFacilities.filter((f) => hasTag(f, ['general'])).slice(0, 8);
      if (list.length === 0) list = dbFacilities.slice(0, 6);
    } else {
      if (action === 'emergency') list = rankFacilities(['emergency']);
      else if (action === 'hospital') list = rankFacilities(['emergency', 'general', 'surgery']);
      else if (action === 'clinic') {
        const ranked = rankFacilities(['general', 'pediatrics']);
        const clinics = ranked.filter((f) => f.type === 'clinic');
        list = clinics.length > 0 ? clinics : ranked.slice(0, 6);
      } else list = rankFacilities(['general']);
    }

    if (coords) {
      return [...list].sort(
        (a, b) => distKm(coords.lat, coords.lon, a) - distKm(coords.lat, coords.lon, b),
      );
    }
    return list;
  }, [action, dbFacilities, coords]);

  const pharmacyRows = useMemo(
    () => matchPharmacies(RECOMMENDED_DRUGS).slice(0, 4),
    [],
  );

  async function pickPrescription() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a prescription image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]?.base64 || !hasSupabaseConfig || !supabase) {
      if (!result.canceled) setUploaded('Could not read image');
      return;
    }
    const { data, error } = await supabase.functions.invoke('prescription-ocr', {
      body: { image_base64: result.assets[0].base64 },
    });
    if (error) {
      setUploaded('Scan failed — try again');
      return;
    }
    const meds = (data as { extracted_medications?: { drug_name: string }[] })?.extracted_medications ?? [];
    const names = meds.map((m) => m.drug_name).filter(Boolean);
    setUploaded(names.length > 0 ? `Detected: ${names.join(', ')}` : 'No medications detected');
  }

  function openNavigateFlow(f: Facility | Pharmacy) {
    setNavTarget(f);
  }

  function openGoogleDirections(f: Facility | Pharmacy) {
    const lat = f.latitude;
    const lon = f.longitude;
    const url = Platform.select({
      ios: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    });
    void Linking.openURL(url ?? '');
    setNavTarget(null);
  }

  function dial(n: string) {
    void Linking.openURL(`tel:${n.replace(/\s/g, '')}`);
  }

  function ambulanceModal() {
    Alert.alert(
      'Ambulance request',
      'Rapha will save a request on your account, then place a call to medical emergency (907).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 907',
          onPress: () => {
            void (async () => {
              if (!hasSupabaseConfig || !supabase) {
                void Linking.openURL('tel:907');
                return;
              }
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              if (!uid) {
                void Linking.openURL('tel:907');
                return;
              }
              const { session } = await getOrCreateSession();
              const sid = session.id;
              const sessionId = /^[0-9a-f-]{36}$/i.test(sid) ? sid : null;
              await supabase.from('service_requests').insert({
                user_id: uid,
                session_id: sessionId,
                request_type: 'ambulance',
                status: 'pending',
                payload: { source: 'services', action },
              });
              void Linking.openURL('tel:907');
            })();
          },
        },
      ],
    );
  }

  function transportModal(title: string) {
    Alert.alert(title, 'Ride booking through Rapha is not available yet. Use your usual ride app or a taxi stand.', [{ text: 'OK' }]);
  }

  const showTransport = action === 'emergency' || action === 'hospital';
  const showPharmacyBlock = action === 'pharmacy' || action === 'default';

  const region = {
    latitude: coords?.lat ?? ADDIS_CENTER.latitude,
    longitude: coords?.lon ?? ADDIS_CENTER.longitude,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.hero, { backgroundColor: header.bg }]}>
        <Text style={styles.heroTitle}>{header.title}</Text>
        <Text style={styles.heroSub}>{header.sub}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.locCard}>
          <MapPin size={20} color={colors.accent} strokeWidth={2} />
          <View style={styles.locMid}>
            <Text style={styles.locMain}>{locationLabel}</Text>
            <Text style={styles.locHint}>Your location</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('Location', 'When GPS is off, listings are ranked from Addis Ababa. Turn on location for nearby results where supported.')
            }
          >
            <Text style={styles.update}>Update</Text>
          </Pressable>
        </View>

        {action !== 'pharmacy' ? (
          <>
            <Text style={styles.secHead}>Nearby facilities</Text>
            {facilityList.slice(0, 6).map((f, index) => (
              <FacilityCard
                key={f.id}
                facility={f}
                recommended={index === 0}
                showAmbulance={action === 'emergency' && index === 0}
                onCall={() => dial(f.phone)}
                onNavigate={() => openNavigateFlow(f)}
                onAmbulance={ambulanceModal}
              />
            ))}

            <View style={styles.mapPreview}>
              <MapView
                style={StyleSheet.absoluteFill}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: coords?.lat ?? ADDIS_CENTER.latitude, longitude: coords?.lon ?? ADDIS_CENTER.longitude }}
                  title="You"
                />
                {facilityList.slice(0, 4).map((f) => (
                  <Marker
                    key={f.id}
                    coordinate={{ latitude: f.latitude, longitude: f.longitude }}
                    title={f.name}
                  />
                ))}
              </MapView>
              <View style={styles.mapOverlay} pointerEvents="none">
                <Text style={styles.mapOverlayText}>Map preview</Text>
              </View>
            </View>
          </>
        ) : null}

        {showPharmacyBlock ? (
          <>
            <Text style={styles.secHead}>Pharmacies with your medications</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drugRow}>
              {RECOMMENDED_DRUGS.map((d) => (
                <View key={d} style={styles.drugChip}>
                  <Text style={styles.drugChipText}>{d}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.uploadRx} onPress={() => void pickPrescription()}>
              <Paperclip size={18} color={colors.accent} strokeWidth={2} />
              <Text style={styles.uploadRxText}>Upload prescription</Text>
            </Pressable>
            {uploaded ? <Text style={styles.uploaded}>{uploaded}</Text> : null}

            {pharmacyRows.map((p) => (
              <PharmacyCard key={p.id} pharmacy={p} drugTotal={RECOMMENDED_DRUGS.length} onDirections={() => openNavigateFlow(p)} />
            ))}
          </>
        ) : null}

        {showTransport ? (
          <>
            <Text style={styles.transHead}>How will you get there?</Text>
            <TransportRow
              icon={<Ambulance size={22} color={colors.emergency} />}
              title="Ambulance"
              sub="Request emergency vehicle"
              onPress={ambulanceModal}
            />
            <TransportRow
              icon={<Car size={22} color={colors.accent} />}
              title="Ride (Ride Ethiopia / Feres)"
              sub="Book a taxi — 4–8 min away"
              onPress={() => transportModal('Ride')}
            />
            <TransportRow
              icon={<User size={22} color={colors.textSecondary} />}
              title="I have transport"
              sub="I'll arrange my own way"
              onPress={() => Alert.alert('Transport', 'Great — stay safe on the way.')}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>

    <Modal visible={navTarget !== null} animationType="slide" onRequestClose={() => setNavTarget(null)}>
      <SafeAreaView style={styles.navModalSafe} edges={['top', 'bottom']}>
        <View style={styles.navModalTop}>
          <Pressable onPress={() => setNavTarget(null)} hitSlop={12}>
            <Text style={styles.navClose}>Close</Text>
          </Pressable>
        </View>
        {navTarget ? (
          <>
            <Text style={styles.navModalTitle}>{navTarget.name}</Text>
            {navLoading ? (
              <ActivityIndicator style={styles.navSpinner} color={colors.accent} />
            ) : (
              <Text style={styles.navAddress} numberOfLines={4}>
                {navPlaceLabel ?? `${navTarget.latitude.toFixed(4)}, ${navTarget.longitude.toFixed(4)}`}
              </Text>
            )}
            <View style={styles.navMap}>
              <MapView
                style={StyleSheet.absoluteFill}
                region={{
                  latitude: navTarget.latitude,
                  longitude: navTarget.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />
                <Marker
                  coordinate={{ latitude: navTarget.latitude, longitude: navTarget.longitude }}
                  title={navTarget.name}
                />
              </MapView>
            </View>
            <Text style={styles.readyPrompt}>Ready to go?</Text>
            <View style={styles.navActions}>
              <Pressable style={styles.navSecondary} onPress={() => setNavTarget(null)}>
                <Text style={styles.navSecondaryTxt}>Not now</Text>
              </Pressable>
              <Pressable style={styles.navPrimary} onPress={() => openGoogleDirections(navTarget)}>
                <Text style={styles.navPrimaryTxt}>Let&apos;s go</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
    </>
  );
}

function FacilityCard({
  facility: f,
  recommended,
  showAmbulance,
  onCall,
  onNavigate,
  onAmbulance,
}: {
  facility: Facility;
  recommended: boolean;
  showAmbulance: boolean;
  onCall: () => void;
  onNavigate: () => void;
  onAmbulance: () => void;
}) {
  return (
    <View style={styles.facCard}>
      {recommended ? (
        <View style={styles.recBanner}>
          <Text style={styles.recText}>⭐ Recommended</Text>
        </View>
      ) : null}
      <View style={styles.facBody}>
        <View style={styles.facTitleRow}>
          <Text style={styles.facName}>{f.name}</Text>
          <View style={[styles.typePill, f.type === 'clinic' ? styles.typeClinic : styles.typeHosp]}>
            <Text style={styles.typePillText}>{f.type === 'clinic' ? 'Clinic' : 'Hospital'}</Text>
          </View>
              </View>
        <Text style={styles.facMeta}>
          📍 {f.neighborhood} · 🕐 {f.etaMinutes ?? '—'} min · 📏 {f.distanceKm ?? '—'} km
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
          {f.capabilityTags.map((tag) => (
            <View
              key={tag}
              style={[styles.tagPill, tag === 'emergency' && styles.tagEmergency]}
            >
              <Text style={[styles.tagTxt, tag === 'emergency' && styles.tagTxtEm]}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.divider} />
        <View style={styles.actions}>
          <Pressable style={styles.outlineBtn} onPress={onCall}>
            <Phone size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.outlineTxt}>Call</Text>
          </Pressable>
          <Pressable style={styles.tealBtn} onPress={onNavigate}>
            <Navigation size={16} color={colors.textOnAccent} strokeWidth={2} />
            <Text style={styles.tealTxt}>Navigate</Text>
          </Pressable>
        </View>
        {showAmbulance ? (
          <Pressable style={styles.ambBtn} onPress={onAmbulance}>
            <Text style={styles.ambTxt}>🚑 Request ambulance</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PharmacyCard({
  pharmacy: p,
  drugTotal,
  onDirections,
}: {
  pharmacy: Pharmacy & { matches: PharmacyStock[]; availableCount: number };
  drugTotal: number;
  onDirections: () => void;
}) {
  const matchPct = Math.round((p.matches.length / Math.max(1, drugTotal)) * 100);
  return (
    <View style={styles.phCard}>
      <Text style={styles.facName}>{p.name}</Text>
      <Text style={styles.facMeta}>
        📍 {p.neighborhood} · Stock match ~{matchPct}%
      </Text>
      <Text style={styles.stockLine}>
        {p.matches.length}/{drugTotal} sample drugs in stock
      </Text>
      {p.matches.map((s) => (
        <Text key={s.id} style={styles.stockItem}>
          ● {s.brandName} ({s.quantity} {s.unit})
        </Text>
      ))}
      <Pressable style={styles.tealBtnFull} onPress={onDirections}>
        <Text style={styles.tealTxt}>Get directions</Text>
      </Pressable>
    </View>
  );
}

function TransportRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.transRow} onPress={onPress}>
      {icon}
      <View style={styles.transMid}>
        <Text style={styles.transTitle}>{title}</Text>
        <Text style={styles.transSub}>{sub}</Text>
            </View>
      <ChevronRight size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 0,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.surface },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  scroll: { paddingBottom: spacing.xxl },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locMid: { flex: 1 },
  locMain: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  locHint: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  update: { fontSize: 13, fontWeight: '700', color: colors.accent },
  secHead: { ...typography.h3, fontSize: 17, marginHorizontal: spacing.md, marginTop: 20, marginBottom: 8 },
  facCard: {
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  recBanner: {
    backgroundColor: colors.urgentLight,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  recText: { fontSize: 12, fontWeight: '700', color: colors.urgent },
  facBody: { padding: 16 },
  facTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  facName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  typeHosp: { backgroundColor: colors.primarySoft },
  typeClinic: { backgroundColor: colors.accentLight },
  typePillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  facMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  tagScroll: { gap: 8, marginTop: 10 },
  tagPill: {
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  tagEmergency: { backgroundColor: colors.emergencyLight },
  tagTxt: { fontSize: 12, color: colors.textSecondary },
  tagTxtEm: { color: colors.emergency, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  outlineTxt: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  tealBtnFull: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tealTxt: { fontSize: 14, fontWeight: '700', color: colors.textOnAccent },
  ambBtn: {
    marginTop: 12,
    backgroundColor: colors.emergency,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ambTxt: { color: colors.surface, fontWeight: '800', fontSize: 15 },
  mapPreview: {
    height: 180,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mapOverlayText: { color: colors.surface, fontWeight: '600', fontSize: 13 },
  drugRow: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: 8 },
  drugChip: {
    backgroundColor: colors.mildLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    marginRight: 8,
  },
  drugChipText: { fontSize: 13, fontWeight: '600', color: colors.mild },
  uploadRx: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    marginTop: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  uploadRxText: { fontSize: 15, fontWeight: '600', color: colors.accent },
  uploaded: { textAlign: 'center', fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  phCard: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockLine: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 8 },
  stockItem: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  transHead: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    marginTop: 24,
    marginBottom: 8,
  },
  transRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  transMid: { flex: 1 },
  transTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  transSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  navModalSafe: { flex: 1, backgroundColor: colors.background },
  navModalTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  navClose: { fontSize: 16, fontWeight: '600', color: colors.accent },
  navModalTitle: {
    ...typography.h3,
    fontSize: 20,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  navAddress: {
    ...typography.bodySmall,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  navSpinner: { marginVertical: spacing.sm },
  navMap: {
    height: 260,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  readyPrompt: {
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    color: colors.textPrimary,
  },
  navActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  navSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  navSecondaryTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  navPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
  },
  navPrimaryTxt: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
