import { useRouter } from 'expo-router';
import { AlertTriangle, Check, Watch } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ADDIS_CENTER } from '../../src/data/facilities';
import { colors, radius, spacing, typography } from '../../src/theme';

const PREF_FALL = 'rapha.pref.fallDetection';
const VITALS_ENTRIES_KEY = 'rapha.vitals.entries';

export type VitalsEntry = {
  id: string;
  temp?: number;
  hr?: number;
  sbp?: number;
  dbp?: number;
  spo2?: number;
  notes?: string;
  at: string;
};

/** Simplified NEWS-style aggregate for demo (not clinical NEWS2). */
function estimateRiskScore(v: VitalsEntry): { score: number; label: string; tone: 'low' | 'mid' | 'high' } {
  let s = 0;
  if (v.temp != null) {
    if (v.temp >= 39) s += 3;
    else if (v.temp >= 38) s += 2;
    else if (v.temp < 35) s += 3;
  }
  if (v.hr != null) {
    if (v.hr >= 130) s += 3;
    else if (v.hr >= 110) s += 1;
    else if (v.hr <= 40) s += 3;
  }
  if (v.sbp != null) {
    if (v.sbp <= 90) s += 3;
    else if (v.sbp >= 200) s += 2;
  }
  if (v.spo2 != null && v.spo2 < 92) s += 3;
  else if (v.spo2 != null && v.spo2 < 95) s += 1;

  if (s <= 4) return { score: s, label: 'Low risk', tone: 'low' };
  if (s <= 6) return { score: s, label: 'Medium risk — see a doctor today', tone: 'mid' };
  return { score: s, label: 'High risk — emergency care', tone: 'high' };
}

const DEVICE_OPTIONS = [
  { id: 'samsung', name: 'Samsung Health', icon: '⌚' },
  { id: 'fitbit', name: 'Fitbit', icon: '⌚' },
  { id: 'garmin', name: 'Garmin', icon: '🛰️' },
  { id: 'mi', name: 'Mi Band', icon: '⌚' },
  ...(Platform.OS === 'ios' ? [{ id: 'apple', name: 'Apple Health', icon: '🍎' }] : []),
  { id: 'manual', name: 'Manual entry', icon: '✏️' },
];

export default function AccessoriesScreen() {
  const router = useRouter();
  const [fallOn, setFallOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [entries, setEntries] = useState<VitalsEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [temp, setTemp] = useState('');
  const [hr, setHr] = useState('');
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const f = await AsyncStorage.getItem(PREF_FALL);
    setFallOn(f === '1');
    const raw = await AsyncStorage.getItem(VITALS_ENTRIES_KEY);
    if (raw) {
      try {
        setEntries(JSON.parse(raw) as VitalsEntry[]);
      } catch {
        setEntries([]);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const last = entries[0];
  const risk = useMemo(() => (last ? estimateRiskScore(last) : null), [last]);

  async function persistFall(v: boolean) {
    setFallOn(v);
    await AsyncStorage.setItem(PREF_FALL, v ? '1' : '0');
  }

  async function logVitals() {
    const entry: VitalsEntry = {
      id: `v-${Date.now()}`,
      temp: temp ? parseFloat(temp) : undefined,
      hr: hr ? parseInt(hr, 10) : undefined,
      sbp: sbp ? parseInt(sbp, 10) : undefined,
      dbp: dbp ? parseInt(dbp, 10) : undefined,
      spo2: spo2 ? parseInt(spo2, 10) : undefined,
      notes: notes.trim() || undefined,
      at: new Date().toISOString(),
    };
    const next = [entry, ...entries].slice(0, 20);
    setEntries(next);
    await AsyncStorage.setItem(VITALS_ENTRIES_KEY, JSON.stringify(next));
    setTemp('');
    setHr('');
    setSbp('');
    setDbp('');
    setSpo2('');
    setNotes('');
    setExpanded(false);
    Alert.alert('Logged', 'Vitals saved on this device.');
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h} hours ago`;
    return d.toLocaleString();
  }

  function shareWithLucas() {
    if (!last) return;
    const parts = [
      last.temp != null ? `Temp ${last.temp}°C` : null,
      last.hr != null ? `HR ${last.hr} bpm` : null,
      last.sbp != null && last.dbp != null ? `BP ${last.sbp}/${last.dbp}` : null,
      last.spo2 != null ? `SpO₂ ${last.spo2}%` : null,
    ]
      .filter(Boolean)
      .join(', ');
    router.push({
      pathname: '/',
      params: { prefill: `My vitals: ${parts}. What should I watch for?` },
    });
  }

  const insights =
    last && risk
      ? risk.tone === 'low'
        ? [
            last.hr != null && last.hr >= 60 && last.hr <= 100
              ? `Heart rate looks typical — ${last.hr} bpm.`
              : null,
            last.temp != null && last.temp >= 36 && last.temp <= 37.5
              ? `Temperature in a common resting range — ${last.temp}°C.`
              : null,
          ].filter(Boolean)
        : [
            last.temp != null && last.temp >= 38
              ? 'Elevated temperature detected — consider contacting Dr Lucas if symptoms worsen.'
              : null,
            last.spo2 != null && last.spo2 < 95
              ? 'Lower oxygen saturation — seek timely advice.'
              : null,
          ].filter(Boolean)
      : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.h2}>Connected Devices</Text>
          <Text style={styles.sub}>Monitor your health in real time</Text>
        </View>

        {!connected ? (
          <View style={styles.bannerWarn}>
            <AlertTriangle size={22} color={colors.urgent} strokeWidth={2} />
            <View style={styles.bannerMid}>
              <Text style={styles.bannerTitle}>No devices connected</Text>
              <Text style={styles.bannerBody}>Connect a wearable to see your vitals here</Text>
              <Pressable style={styles.connBtn} onPress={() => setConnected(true)}>
                <Text style={styles.connBtnText}>Connect device</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {fallOn ? (
          <View style={styles.bannerOk}>
            <Check size={22} color={colors.mild} strokeWidth={2} />
            <View style={styles.bannerMid}>
              <Text style={styles.bannerTitleOk}>Fall detection active</Text>
              <Text style={styles.bannerBody}>Phone accelerometer monitoring for falls</Text>
            </View>
          </View>
        ) : null}

        {!connected ? (
          <View style={styles.emptyCard}>
            <Watch size={48} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No wearables connected</Text>
            <Text style={styles.emptySub}>
              Connect your smartwatch or fitness tracker to see health metrics
            </Text>
            <View style={styles.grid}>
              {DEVICE_OPTIONS.map((d) => (
                <Pressable key={d.id} style={styles.gridCell} onPress={() => Alert.alert(d.name, 'Demo connection — no OAuth in MVP.')}>
                  <Text style={styles.gridIco}>{d.icon}</Text>
                  <Text style={styles.gridName}>{d.name}</Text>
                  <Text style={styles.gridTap}>Tap to connect</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>📊 Log vitals manually</Text>
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.addTeal}>{expanded ? 'Collapse' : 'Add entry'}</Text>
            </Pressable>
          </View>
          {last ? (
            <View style={styles.lastRow}>
              <View style={styles.pills}>
                {last.temp != null ? (
                  <Text style={styles.pill}>🌡️ {last.temp}°C</Text>
                ) : null}
                {last.hr != null ? <Text style={styles.pill}>❤️ {last.hr} bpm</Text> : null}
                {last.sbp != null && last.dbp != null ? (
                  <Text style={styles.pill}>
                    🩸 {last.sbp}/{last.dbp}
                  </Text>
                ) : null}
                {last.spo2 != null ? <Text style={styles.pill}>O₂ {last.spo2}%</Text> : null}
              </View>
              <Text style={styles.loggedAt}>Logged {formatTime(last.at)}</Text>
              <Pressable onPress={() => undefined}>
                <Text style={styles.viewHist}>View history →</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.hint}>No entries yet — add your first reading.</Text>
          )}

          {expanded ? (
            <View style={styles.form}>
              <Field label="Temperature" unit="°C" value={temp} onChangeText={setTemp} keyboard="decimal-pad" />
              <Field label="Heart rate" unit="bpm" value={hr} onChangeText={setHr} keyboard="number-pad" />
              <View style={styles.bpRow}>
                <Text style={styles.lbl}>Blood pressure</Text>
                <View style={styles.bpInputs}>
                  <TextInput
                    style={styles.in}
                    value={sbp}
                    onChangeText={setSbp}
                    keyboardType="number-pad"
                    placeholder="120"
                  />
                  <Text style={styles.slash}>/</Text>
                  <TextInput
                    style={styles.in}
                    value={dbp}
                    onChangeText={setDbp}
                    keyboardType="number-pad"
                    placeholder="80"
                  />
                  <Text style={styles.unit}>mmHg</Text>
                </View>
              </View>
              <Field label="SpO₂" unit="%" value={spo2} onChangeText={setSpo2} keyboard="number-pad" />
              <Text style={styles.lbl}>Notes</Text>
              <TextInput style={[styles.in, styles.notes]} value={notes} onChangeText={setNotes} multiline />
              <Pressable style={styles.logBtn} onPress={logVitals}>
                <Text style={styles.logBtnText}>Log vitals</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {last && risk ? (
          <View style={styles.news}>
            <Text style={styles.newsLabel}>NEWS2 Score</Text>
            <Text style={styles.newsNum}>{risk.score}</Text>
            <View
              style={[
                styles.riskPill,
                risk.tone === 'low' && { backgroundColor: colors.accentLight },
                risk.tone === 'mid' && { backgroundColor: colors.urgentLight },
                risk.tone === 'high' && { backgroundColor: colors.emergencyLight },
              ]}
            >
              <Text
                style={[
                  styles.riskTxt,
                  risk.tone === 'low' && { color: colors.accentDark },
                  risk.tone === 'mid' && { color: colors.urgent },
                  risk.tone === 'high' && { color: colors.emergency },
                ]}
              >
                {risk.label}
              </Text>
            </View>
            <Text style={styles.newsFoot}>Based on your last vital signs</Text>
            <Pressable style={styles.shareLucas} onPress={shareWithLucas}>
              <Text style={styles.shareLucasText}>Share with Dr Lucas</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.fallRow}>
            <Text style={styles.fallIco}>💥</Text>
            <View style={styles.fallMid}>
              <Text style={styles.fallTitle}>Fall detection</Text>
              <Text style={styles.fallSub}>Uses phone accelerometer</Text>
            </View>
            <Switch
              value={fallOn}
              onValueChange={(v) => void persistFall(v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
          <Text style={fallOn ? styles.fallStatusOn : styles.fallStatusOff}>
            {fallOn ? '✓ Monitoring active — session-based demo' : 'Fall detection is off'}
          </Text>
        </View>

        {last ? (
          <View style={styles.card}>
            <Text style={styles.insTitle}>Personalized insights</Text>
            {insights.length > 0 ? (
              insights.map((line) => (
                <Text key={line} style={styles.insLine}>
                  {risk?.tone === 'low' ? '✅ ' : '⚠️ '}
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.insLine}>Log more vitals for tailored tips.</Text>
            )}
            {risk && risk.tone !== 'low' ? (
              <Pressable style={styles.talkLucas} onPress={shareWithLucas}>
                <Text style={styles.talkLucasText}>Talk to Dr Lucas</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.mapHint}>
          Location demo: {ADDIS_CENTER.latitude.toFixed(2)}, {ADDIS_CENTER.longitude.toFixed(2)}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  unit,
  value,
  onChangeText,
  keyboard,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboard: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.lbl}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.in}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboard}
          placeholder="—"
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  h2: { ...typography.h2 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  bannerWarn: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    backgroundColor: colors.urgentLight,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  bannerOk: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.mildLight,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  bannerMid: { flex: 1 },
  bannerTitle: { fontWeight: '700', color: colors.textPrimary },
  bannerTitleOk: { fontWeight: '700', color: colors.mild },
  bannerBody: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  connBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.urgent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  connBtnText: { color: colors.surface, fontWeight: '700', fontSize: 13 },
  emptyCard: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
    justifyContent: 'center',
  },
  gridCell: {
    width: '30%',
    minWidth: 100,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  gridIco: { fontSize: 24 },
  gridName: { fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  gridTap: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  addTeal: { fontSize: 13, fontWeight: '600', color: colors.accent },
  lastRow: { marginTop: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    fontSize: 13,
    color: colors.textPrimary,
  },
  loggedAt: { fontSize: 12, color: colors.textTertiary, marginTop: 10 },
  viewHist: { fontSize: 13, fontWeight: '600', color: colors.accent, marginTop: 6 },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  form: { marginTop: 16, gap: 10 },
  field: { marginBottom: 8 },
  lbl: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  in: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  unit: { fontSize: 13, color: colors.textTertiary, width: 48 },
  bpRow: { marginBottom: 8 },
  bpInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slash: { fontSize: 18, color: colors.textSecondary },
  logBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logBtnText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 15 },
  news: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
  },
  newsLabel: { fontSize: 12, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  newsNum: { fontSize: 48, fontWeight: '800', color: colors.surface, marginVertical: 8 },
  riskPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full },
  riskTxt: { fontSize: 13, fontWeight: '700' },
  newsFoot: { fontSize: 12, color: colors.textTertiary, marginTop: 12 },
  shareLucas: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
  },
  shareLucasText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  fallRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fallIco: { fontSize: 24 },
  fallMid: { flex: 1 },
  fallTitle: { fontSize: 14, fontWeight: '700' },
  fallSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  fallStatusOn: { fontSize: 12, color: colors.accent, marginTop: 10 },
  fallStatusOff: { fontSize: 12, color: colors.textTertiary, marginTop: 10 },
  insTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  insLine: { fontSize: 13, color: colors.textPrimary, marginBottom: 8, lineHeight: 20 },
  talkLucas: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
  },
  talkLucasText: { color: colors.textOnAccent, fontWeight: '700' },
  mapHint: { textAlign: 'center', fontSize: 11, color: colors.textTertiary, marginTop: spacing.lg },
});
