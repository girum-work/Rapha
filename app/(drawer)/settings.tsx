import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  ChevronRight,
  Droplets,
  Home,
  Mail,
  MapPin,
  Phone,
  Pill,
  Shield,
  User,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/theme';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const PREF_PUSH = 'rapha.pref.pushNotifications';
const PREF_FALL = 'rapha.pref.fallDetection';

type ProfileState = {
  display_name: string;
  age: string;
  blood_type: string;
  allergies: string;
  current_medications: string;
  chronic_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  location_consent: boolean;
};

function parseCsvArrays(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function useDebouncedSave(
  save: (patch: Record<string, unknown>) => Promise<void>,
  ms: number,
) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return useCallback(
    (patch: Record<string, unknown>) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => {
        void save(patch);
      }, ms);
    },
    [save, ms],
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [initial, setInitial] = useState('R');
  const [profile, setProfile] = useState<ProfileState>({
    display_name: '',
    age: '',
    blood_type: '',
    allergies: '',
    current_medications: '',
    chronic_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    location_consent: false,
  });
  const [pushPref, setPushPref] = useState(true);
  const [fallPref, setFallPref] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [bloodModal, setBloodModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const userIdRef = useRef<string | null>(null);

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!hasSupabaseConfig || !supabase || !userIdRef.current) return;
      const { error } = await supabase.from('profiles').update(patch).eq('id', userIdRef.current);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    },
    [],
  );

  const debouncedPersist = useDebouncedSave(persist, 500);

  useEffect(() => {
    void (async () => {
      const push = await AsyncStorage.getItem(PREF_PUSH);
      const fall = await AsyncStorage.getItem(PREF_FALL);
      setPushPref(push !== '0');
      setFallPref(fall === '1');
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!hasSupabaseConfig || !supabase) return;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const em = auth.user?.email ?? '';
      setEmail(em);
      if (!uid) return;
      userIdRef.current = uid;
      const nameFromEmail = em.split('@')[0] || 'U';
      setInitial(nameFromEmail.charAt(0).toUpperCase());

      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!data) return;
      const row = data as Record<string, unknown>;
      const dn = typeof row.display_name === 'string' ? row.display_name : '';
      setInitial((dn.trim().charAt(0) || nameFromEmail.charAt(0)).toUpperCase());
      setProfile({
        display_name: dn,
        age: row.age != null ? String(row.age) : '',
        blood_type: typeof row.blood_type === 'string' ? row.blood_type : '',
        allergies: Array.isArray(row.allergies) ? row.allergies.join(', ') : '',
        current_medications: Array.isArray(row.current_medications)
          ? row.current_medications.join(', ')
          : '',
        chronic_conditions: Array.isArray(row.chronic_conditions)
          ? row.chronic_conditions.join(', ')
          : '',
        emergency_contact_name: typeof row.emergency_contact_name === 'string' ? row.emergency_contact_name : '',
        emergency_contact_phone: typeof row.emergency_contact_phone === 'string' ? row.emergency_contact_phone : '',
        location_consent: !!row.location_consent,
      });
    })();
  }, []);

  function updateLocal<K extends keyof ProfileState>(key: K, value: ProfileState[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function queueSave(patch: Partial<ProfileState>) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.display_name !== undefined) dbPatch.display_name = patch.display_name.trim() || null;
    if (patch.age !== undefined) {
      const n = parseInt(patch.age, 10);
      dbPatch.age = Number.isFinite(n) ? n : null;
    }
    if (patch.blood_type !== undefined) dbPatch.blood_type = patch.blood_type.trim() || null;
    if (patch.allergies !== undefined) dbPatch.allergies = parseCsvArrays(patch.allergies);
    if (patch.current_medications !== undefined)
      dbPatch.current_medications = parseCsvArrays(patch.current_medications);
    if (patch.chronic_conditions !== undefined)
      dbPatch.chronic_conditions = parseCsvArrays(patch.chronic_conditions);
    if (patch.emergency_contact_name !== undefined)
      dbPatch.emergency_contact_name = patch.emergency_contact_name.trim() || null;
    if (patch.emergency_contact_phone !== undefined)
      dbPatch.emergency_contact_phone = patch.emergency_contact_phone.trim() || null;
    if (patch.location_consent !== undefined) dbPatch.location_consent = patch.location_consent;
    debouncedPersist(dbPatch);
  }

  async function handleSignOut() {
    if (hasSupabaseConfig && supabase) {
      await supabase.auth.signOut();
    }
    router.replace('/sign-in');
  }

  async function submitPassword() {
    if (newPw.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }
    setPwModal(false);
    setNewPw('');
    setConfirmPw('');
    Alert.alert('Password updated');
  }

  const medicalRows = useMemo(
    () => [
      {
        key: 'blood',
        icon: <Droplets size={20} color={colors.accent} />,
        label: 'Blood type',
        value: profile.blood_type || null,
        danger: !profile.blood_type,
        onPress: () => setBloodModal(true),
      },
      {
        key: 'name',
        icon: <User size={20} color={colors.accent} />,
        label: 'Full name',
        value: profile.display_name || null,
        danger: !profile.display_name?.trim(),
        onPress: () => setExpanded((e) => (e === 'name' ? null : 'name')),
      },
      {
        key: 'age',
        icon: <Calendar size={20} color={colors.accent} />,
        label: 'Age',
        value: profile.age || null,
        danger: false,
        onPress: () => setExpanded((e) => (e === 'age' ? null : 'age')),
      },
      {
        key: 'allergies',
        icon: <Shield size={20} color={colors.accent} />,
        label: 'Allergies',
        value: profile.allergies || null,
        danger: false,
        onPress: () => setExpanded((e) => (e === 'allergies' ? null : 'allergies')),
      },
      {
        key: 'medications',
        icon: <Pill size={20} color={colors.accent} />,
        label: 'Medications',
        value: profile.current_medications || null,
        danger: false,
        onPress: () => setExpanded((e) => (e === 'medications' ? null : 'medications')),
      },
      {
        key: 'conditions',
        icon: <Home size={20} color={colors.accent} />,
        label: 'Conditions',
        value: profile.chronic_conditions || null,
        danger: false,
        onPress: () => setExpanded((e) => (e === 'conditions' ? null : 'conditions')),
      },
      {
        key: 'emergency',
        icon: <Phone size={20} color={colors.accent} />,
        label: 'Emergency contact',
        value:
          [profile.emergency_contact_name, profile.emergency_contact_phone].filter(Boolean).join(' · ') ||
          null,
        danger: !profile.emergency_contact_name?.trim(),
        onPress: () => setExpanded((e) => (e === 'emergency' ? null : 'emergency')),
      },
    ],
    [profile],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <View style={styles.userText}>
              <Text style={styles.userName}>{profile.display_name?.trim() || 'Your profile'}</Text>
              <Text style={styles.userEmail}>{email || '—'}</Text>
            </View>
          </View>
          <Pressable style={styles.editProfileBtn} onPress={() => setExpanded('name')}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </Pressable>
          {savedFlash ? <Text style={styles.saved}>Saved ✓</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Shield size={16} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Medical Profile</Text>
          </View>
          <View style={styles.card}>
            {medicalRows.map((row, i) => (
              <View key={row.key}>
                <Pressable style={[styles.row, i > 0 && styles.rowBorder]} onPress={row.onPress}>
                  <View style={styles.rowLeft}>{row.icon}</View>
                  <View style={styles.rowMid}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text
                      style={[styles.rowValue, row.danger && !row.value && styles.rowDanger]}
                      numberOfLines={2}
                    >
                      {row.value?.trim() ? row.value : row.danger ? 'Not set' : '—'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textTertiary} />
                </Pressable>
                {expanded === row.key ? (
                  <View style={styles.inline}>
                    {row.key === 'name' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={profile.display_name}
                        placeholder="Full name"
                        placeholderTextColor={colors.textTertiary}
                        onChangeText={(t) => {
                          updateLocal('display_name', t);
                          queueSave({ display_name: t });
                        }}
                      />
                    ) : null}
                    {row.key === 'age' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={profile.age}
                        keyboardType="number-pad"
                        placeholder="Age"
                        placeholderTextColor={colors.textTertiary}
                        onChangeText={(t) => {
                          updateLocal('age', t);
                          queueSave({ age: t });
                        }}
                      />
                    ) : null}
                    {row.key === 'allergies' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={profile.allergies}
                        placeholder="Comma-separated allergies"
                        placeholderTextColor={colors.textTertiary}
                        onChangeText={(t) => {
                          updateLocal('allergies', t);
                          queueSave({ allergies: t });
                        }}
                      />
                    ) : null}
                    {row.key === 'medications' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={profile.current_medications}
                        placeholder="Comma-separated medications"
                        placeholderTextColor={colors.textTertiary}
                        onChangeText={(t) => {
                          updateLocal('current_medications', t);
                          queueSave({ current_medications: t });
                        }}
                      />
                    ) : null}
                    {row.key === 'conditions' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={profile.chronic_conditions}
                        placeholder="Comma-separated conditions"
                        placeholderTextColor={colors.textTertiary}
                        onChangeText={(t) => {
                          updateLocal('chronic_conditions', t);
                          queueSave({ chronic_conditions: t });
                        }}
                      />
                    ) : null}
                    {row.key === 'emergency' ? (
                      <View style={styles.emergencyInputs}>
                        <TextInput
                          style={styles.inlineInput}
                          value={profile.emergency_contact_name}
                          placeholder="Contact name"
                          placeholderTextColor={colors.textTertiary}
                          onChangeText={(t) => {
                            updateLocal('emergency_contact_name', t);
                            queueSave({ emergency_contact_name: t });
                          }}
                        />
                        <TextInput
                          style={styles.inlineInput}
                          value={profile.emergency_contact_phone}
                          placeholder="Phone"
                          keyboardType="phone-pad"
                          placeholderTextColor={colors.textTertiary}
                          onChangeText={(t) => {
                            updateLocal('emergency_contact_phone', t);
                            queueSave({ emergency_contact_phone: t });
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <MapPin size={20} color={colors.accent} />
              <View style={styles.toggleMid}>
                <Text style={styles.rowLabel}>Location for facility ranking</Text>
                <Text style={styles.toggleHint}>When off, care search defaults to Addis Ababa, Ethiopia</Text>
              </View>
              <Switch
                value={profile.location_consent}
                onValueChange={(v) => {
                  updateLocal('location_consent', v);
                  queueSave({ location_consent: v });
                }}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <Bell size={20} color={colors.accent} />
              <View style={styles.toggleMid}>
                <Text style={styles.rowLabel}>Push notifications</Text>
              </View>
              <Switch
                value={pushPref}
                onValueChange={(v) => {
                  void (async () => {
                    if (v) {
                      const { status } = await Notifications.requestPermissionsAsync();
                      if (status !== 'granted') {
                        Alert.alert(
                          'Notifications',
                          'Permission was denied. You can turn on alerts later in system settings.',
                        );
                        setPushPref(false);
                        await AsyncStorage.setItem(PREF_PUSH, '0');
                        return;
                      }
                    }
                    setPushPref(v);
                    await AsyncStorage.setItem(PREF_PUSH, v ? '1' : '0');
                  })();
                }}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <Text style={styles.fallIcon}>💥</Text>
              <View style={styles.toggleMid}>
                <Text style={styles.rowLabel}>Fall detection</Text>
              </View>
              <Switch
                value={fallPref}
                onValueChange={(v) => {
                  setFallPref(v);
                  void AsyncStorage.setItem(PREF_FALL, v ? '1' : '0');
                }}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => setPwModal(true)}>
              <Text style={styles.rowLabel}>🔒 Change password</Text>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Pressable>
            <View style={[styles.row, styles.rowBorder]}>
              <Mail size={18} color={colors.textSecondary} />
              <View style={styles.rowMid}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowMuted}>{email || '—'}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => void Linking.openURL('https://www.who.int/privacy')}
            >
              <Text style={styles.rowLabel}>🔐 Privacy policy</Text>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Pressable>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => void Linking.openURL('https://www.who.int/about/policies/terms')}
            >
              <Text style={styles.rowLabel}>📋 Terms of service</Text>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.signOut} onPress={() => handleSignOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.footer}>Rapha v1.0 · Ethiopia MVP</Text>
        <Text style={styles.footer}>Made with care for Ethiopian healthcare</Text>
      </ScrollView>

      <Modal visible={bloodModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setBloodModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Blood type</Text>
            {BLOOD_TYPES.map((bt) => (
              <Pressable
                key={bt}
                style={styles.modalRow}
                onPress={() => {
                  updateLocal('blood_type', bt);
                  queueSave({ blood_type: bt });
                  setBloodModal(false);
                }}
              >
                <Text style={styles.modalRowText}>{bt}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pwModal} transparent animationType="slide">
        <View style={styles.pwBackdrop}>
          <View style={styles.pwCard}>
            <Text style={styles.modalTitle}>New password</Text>
            <TextInput
              style={styles.inlineInput}
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.inlineInput}
              secureTextEntry
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Confirm password"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.pwActions}>
              <Pressable style={styles.pwCancel} onPress={() => setPwModal(false)}>
                <Text style={styles.pwCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.pwOk} onPress={() => void submitPassword()}>
                <Text style={styles.pwOkText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.surfaceDark,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    marginBottom: spacing.md,
  },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceDarkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '600', color: colors.onDark },
  userText: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '600', color: colors.onDark },
  userEmail: { fontSize: 13, color: colors.onDarkSoft, marginTop: 4 },
  editProfileBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editProfileText: { fontSize: 13, color: colors.onDark, fontWeight: '500' },
  saved: { marginTop: 8, fontSize: 13, color: colors.accentTeal },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLeft: { width: 28 },
  rowMid: { flex: 1 },
  rowLabel: { ...typography.body, fontWeight: '600', fontSize: 14 },
  rowValue: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  rowDanger: { color: colors.emergency },
  rowMuted: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },
  inline: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.surfaceSoft },
  inlineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  emergencyInputs: { gap: 0 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  toggleMid: { flex: 1 },
  toggleHint: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  fallIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  signOut: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: colors.emergency },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalTitle: { ...typography.h3, marginBottom: spacing.sm },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { fontSize: 16, color: colors.textPrimary },
  pwBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pwCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pwActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
  pwCancel: { padding: 12 },
  pwCancelText: { color: colors.textSecondary, fontWeight: '600' },
  pwOk: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.sm },
  pwOkText: { color: colors.textOnAccent, fontWeight: '700' },
});
