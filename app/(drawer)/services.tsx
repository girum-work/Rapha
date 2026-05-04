import { useLocalSearchParams } from 'expo-router';
import { Ambulance, Car, ChevronRight, MapPin, Navigation, Paperclip, Phone, User } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ADDIS_CENTER, facilities } from '../../src/data/facilities';
import { matchPharmacies, rankFacilities } from '../../src/lib/facilitySearch';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Facility, Pharmacy, PharmacyStock } from '../../src/types';

const DEFAULT_LOCATION_LABEL = 'Addis Ababa, Ethiopia';

const RECOMMENDED_DRUGS = ['paracetamol', 'oral rehydration salts', 'amoxicillin', 'cetirizine'];

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ action?: string; conditionName?: string }>();
  const action = (params.action as string) ?? 'default';
  const conditionName = typeof params.conditionName === 'string' ? params.conditionName : null;

  const [uploaded, setUploaded] = useState<string | null>(null);
  const [locationLabel] = useState(DEFAULT_LOCATION_LABEL);

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
    if (action === 'emergency') return rankFacilities(['emergency']);
    if (action === 'hospital') return rankFacilities(['emergency', 'general', 'surgery']);
    if (action === 'clinic') {
      const ranked = rankFacilities(['general', 'pediatrics']);
      const clinics = ranked.filter((f) => f.type === 'clinic');
      if (clinics.length > 0) return clinics;
      return ranked.slice(0, 6);
    }
    return rankFacilities(['general']);
  }, [action]);

  const pharmacyRows = useMemo(
    () => matchPharmacies(RECOMMENDED_DRUGS).slice(0, 4),
    [],
  );

  async function pickPrescription() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setUploaded(result.assets[0]?.fileName ?? 'Image selected');
  }

  function openMaps(f: Facility | Pharmacy) {
    const url = Platform.select({
      ios: `maps:0,0?q=${f.latitude},${f.longitude}`,
      android: `geo:0,0?q=${f.latitude},${f.longitude}(${encodeURIComponent('Facility')})`,
      default: `https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=15/${f.latitude}/${f.longitude}`,
    });
    void Linking.openURL(url ?? '');
  }

  function dial(n: string) {
    void Linking.openURL(`tel:${n.replace(/\s/g, '')}`);
  }

  function ambulanceModal() {
    Alert.alert('Ambulance request', 'This button prepares your details. Call emergency services directly for a live ambulance.', [
      { text: 'OK' },
    ]);
  }

  function transportModal(title: string) {
    Alert.alert(title, 'Ride booking through Rapha is not available yet. Use your usual ride app or a taxi stand.', [{ text: 'OK' }]);
  }

  const showTransport = action === 'emergency' || action === 'hospital';
  const showPharmacyBlock = action === 'pharmacy' || action === 'default';

  const region = {
    latitude: ADDIS_CENTER.latitude,
    longitude: ADDIS_CENTER.longitude,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
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
                onNavigate={() => openMaps(f)}
                onAmbulance={ambulanceModal}
              />
            ))}

            <Pressable
              style={styles.mapPreview}
              onPress={() => Alert.alert('Map', 'Full-screen map route can be added in Part 4.')}
            >
              <MapView
                style={StyleSheet.absoluteFill}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker coordinate={{ latitude: ADDIS_CENTER.latitude, longitude: ADDIS_CENTER.longitude }} title="You" />
                {facilityList.slice(0, 4).map((f) => (
                  <Marker
                    key={f.id}
                    coordinate={{ latitude: f.latitude, longitude: f.longitude }}
                    title={f.name}
                  />
                ))}
              </MapView>
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayText}>Tap to expand map</Text>
              </View>
            </Pressable>
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
              <PharmacyCard key={p.id} pharmacy={p} drugTotal={RECOMMENDED_DRUGS.length} onDirections={() => openMaps(p)} />
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
});
