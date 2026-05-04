import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useToast } from '../src/context/ToastContext';
import { formatAuthProfileError, getCurrentSession, saveOnboardingProfile } from '../src/lib/authProfile';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, fonts, radius, spacing, typography } from '../src/theme';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;

function TagField({
  label,
  hint,
  tags,
  onChange,
  examples,
}: {
  label: string;
  hint: string;
  tags: string[];
  onChange: (next: string[]) => void;
  examples: string[];
}) {
  const [draft, setDraft] = useState('');

  const commitDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    if (!tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  }, [draft, onChange, tags]);

  const onChangeText = useCallback(
    (t: string) => {
      if (t.includes(',') || t.includes('\n')) {
        const parts = t.split(/[,\n]+/);
        const last = parts.pop() ?? '';
        const toAdd = parts.map((p) => p.trim()).filter(Boolean);
        let next = [...tags];
        for (const p of toAdd) {
          if (!next.includes(p)) next = [...next, p];
        }
        onChange(next);
        setDraft(last);
        return;
      }
      setDraft(t);
    },
    [onChange, tags],
  );

  const remove = useCallback(
    (x: string) => {
      onChange(tags.filter((t) => t !== x));
    },
    [onChange, tags],
  );

  return (
    <View style={tagStyles.block}>
      <Text style={tagStyles.label}>{label}</Text>
      <Text style={tagStyles.hint}>{hint}</Text>
      <View style={tagStyles.chipWrap}>
        {tags.map((t) => (
          <View key={t} style={tagStyles.chip}>
            <Text style={tagStyles.chipText}>{t}</Text>
            <Pressable hitSlop={8} onPress={() => remove(t)}>
              <X size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        ))}
        {examples
          .filter((e) => !tags.includes(e))
          .slice(0, 3)
          .map((e) => (
            <Pressable key={e} style={tagStyles.ghost} onPress={() => !tags.includes(e) && onChange([...tags, e])}>
              <Text style={tagStyles.ghostText}>{e}</Text>
            </Pressable>
          ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={onChangeText}
        onSubmitEditing={commitDraft}
        blurOnSubmit={false}
        style={tagStyles.input}
        placeholder="Type and press comma or return"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const tagStyles = StyleSheet.create({
  block: { gap: spacing.xs, marginBottom: spacing.lg },
  label: { ...typography.label, fontFamily: fonts.bodySemiBold, color: colors.textPrimary },
  hint: { ...typography.bodySmall, fontFamily: fonts.body, color: colors.textSecondary, marginBottom: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: { fontSize: typography.bodySmall.fontSize, fontFamily: fonts.bodyMedium, color: colors.textPrimary },
  ghost: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  ghostText: { fontSize: typography.bodySmall.fontSize, fontFamily: fonts.body, color: colors.textTertiary },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
});

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [bloodModal, setBloodModal] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [chronic, setChronic] = useState<string[]>([]);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [locationConsent, setLocationConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const parsedAge = useMemo(() => {
    const n = Number(age);
    return Number.isFinite(n) && n > 0 && n < 130 ? n : null;
  }, [age]);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Photo access was denied', 'error');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
    });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  }, [showToast]);

  const validateStep0 = () => {
    if (!name.trim()) return 'Add your full name to continue.';
    if (parsedAge == null) return 'Add a valid age.';
    if (!bloodType.trim()) return 'Choose your blood type.';
    return null;
  };

  const validateStep2 = () => {
    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      return 'Add emergency contact name and phone.';
    }
    const digits = emergencyPhone.replace(/\s/g, '');
    if (!/^09\d{8}$/.test(digits)) {
      return 'Use an Ethiopian mobile number like 09XXXXXXXX.';
    }
    return null;
  };

  const goNext = () => {
    if (step === 0) {
      const e = validateStep0();
      if (e) {
        showToast(e, 'error');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  async function complete() {
    const e = validateStep2();
    if (e) {
      showToast(e, 'error');
      return;
    }
    if (!hasSupabaseConfig || !supabase) {
      showToast('App configuration is incomplete.', 'error');
      return;
    }
    setBusy(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user?.id) {
        router.replace('/sign-in');
        return;
      }
      await saveOnboardingProfile(session.user.id, {
        name: name.trim(),
        age: parsedAge,
        bloodType: bloodType.trim(),
        allergies,
        currentMedications: medications,
        chronicConditions: chronic,
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.replace(/\s/g, ''),
        locationConsent,
      });
      showToast('Profile saved', 'success');
      router.replace('/(drawer)/dashboard');
    } catch (err) {
      showToast(formatAuthProfileError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenErrorBoundary>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          {step > 0 ? (
            <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View>
              <Text style={styles.title}>Tell us about you</Text>
              <Text style={styles.sub}>This helps Dr Lucas guide you safely.</Text>
              <Pressable style={styles.avatarWrap} onPress={pickPhoto}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarEmpty}>
                    <Camera size={28} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.avatarHint}>Add photo (optional)</Text>
                  </View>
                )}
              </Pressable>
              <Text style={styles.fieldLabel}>Full name *</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Full name" placeholderTextColor={colors.textTertiary} />
              <Text style={styles.fieldLabel}>Age *</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="Your age"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Blood type *</Text>
              <Pressable style={styles.select} onPress={() => setBloodModal(true)}>
                <Text style={bloodType ? styles.selectVal : styles.selectPh}>{bloodType || 'Choose blood type'}</Text>
              </Pressable>
              <Pressable style={styles.tealBtn} onPress={goNext}>
                <Text style={styles.tealBtnText}>Continue</Text>
                <ChevronRight size={20} color={colors.textOnAccent} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Text style={styles.title}>Medical history</Text>
              <Text style={styles.sub}>You can skip items that do not apply.</Text>
              <TagField
                label="Any allergies?"
                hint="Type and press comma or return to add each item."
                tags={allergies}
                onChange={setAllergies}
                examples={['Penicillin', 'Peanuts', 'Latex']}
              />
              <TagField
                label="Current medications?"
                hint="Include dose if you know it."
                tags={medications}
                onChange={setMedications}
                examples={['Metformin', 'Amoxicillin', 'None']}
              />
              <TagField
                label="Chronic conditions?"
                hint="Conditions you manage long term."
                tags={chronic}
                onChange={setChronic}
                examples={['Diabetes', 'Asthma', 'Hypertension', 'None']}
              />
              <Pressable style={styles.tealBtn} onPress={goNext}>
                <Text style={styles.tealBtnText}>Continue</Text>
                <ChevronRight size={20} color={colors.textOnAccent} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.title}>Emergency contact</Text>
              <Text style={styles.sub}>Who should we notify in emergencies?</Text>
              <Text style={styles.fieldLabel}>Contact name *</Text>
              <TextInput
                value={emergencyName}
                onChangeText={setEmergencyName}
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Phone * (09XXXXXXXX)</Text>
              <TextInput
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
                style={styles.input}
                placeholder="09XXXXXXXX"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.switchCard}>
                <View style={styles.switchText}>
                  <Text style={styles.switchTitle}>Allow location for facility finding</Text>
                  <Text style={styles.switchSub}>
                    Rapha uses this to find the nearest hospitals and pharmacies when you ask for care.
                  </Text>
                </View>
                <Switch
                  value={locationConsent}
                  onValueChange={setLocationConsent}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.surface}
                />
              </View>
              <Pressable style={[styles.tealBtn, busy && { opacity: 0.7 }]} onPress={complete} disabled={busy}>
                <Text style={styles.tealBtnText}>{busy ? 'Saving…' : 'Complete setup'}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={bloodModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setBloodModal(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Blood type</Text>
              {BLOOD_TYPES.map((bt) => (
                <Pressable
                  key={bt}
                  style={styles.modalRow}
                  onPress={() => {
                    setBloodType(bt);
                    setBloodModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{bt}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { minWidth: 72 },
  backText: { fontFamily: fonts.bodyMedium, fontSize: typography.body.fontSize, color: colors.accent },
  backPlaceholder: { width: 72 },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.h2, fontFamily: fonts.bodySemiBold, marginBottom: spacing.xs },
  sub: { ...typography.bodySmall, fontFamily: fonts.body, color: colors.textSecondary, marginBottom: spacing.lg },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.lg },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarEmpty: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  avatarHint: { fontSize: 11, fontFamily: fonts.body, color: colors.textTertiary },
  fieldLabel: { ...typography.label, fontFamily: fonts.bodySemiBold, color: colors.textPrimary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  select: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  selectVal: { fontFamily: fonts.body, fontSize: typography.body.fontSize, color: colors.textPrimary },
  selectPh: { fontFamily: fonts.body, fontSize: typography.body.fontSize, color: colors.textTertiary },
  tealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  tealBtnText: { ...typography.authCta, fontFamily: fonts.bodySemiBold, color: colors.textOnAccent },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  switchText: { flex: 1, gap: spacing.xs },
  switchTitle: { fontFamily: fonts.bodySemiBold, fontSize: typography.body.fontSize, color: colors.textPrimary },
  switchSub: { fontFamily: fonts.body, fontSize: typography.bodySmall.fontSize, color: colors.textSecondary, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.h3,
    fontFamily: fonts.bodySemiBold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  modalRowText: { fontFamily: fonts.body, fontSize: typography.body.fontSize, color: colors.textPrimary },
});
