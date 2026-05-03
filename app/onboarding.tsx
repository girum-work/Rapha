import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Body, Button, Muted, Title } from '../src/components/ui';
import { getCurrentSession, saveOnboardingProfile } from '../src/lib/authProfile';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, radius, spacing } from '../src/theme';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [locationConsent, setLocationConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const parsedAge = useMemo(() => {
    const n = Number(age);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [age]);

  function splitList(value: string) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  async function handleSave() {
    if (!hasSupabaseConfig || !supabase) {
      Alert.alert('Supabase not configured', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    if (!name.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      Alert.alert('Missing required fields', 'Please add your name and emergency contact details.');
      return;
    }
    setBusy(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user?.id) {
        Alert.alert('Session expired', 'Please sign in again.');
        router.replace('/sign-in');
        return;
      }
      await saveOnboardingProfile(session.user.id, {
        name: name.trim(),
        age: parsedAge,
        bloodType: bloodType.trim(),
        allergies: splitList(allergies),
        currentMedications: splitList(currentMedications),
        chronicConditions: splitList(chronicConditions),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        locationConsent,
      });
      router.replace('/(drawer)/dashboard');
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header strip */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoLetter}>R</Text>
        </View>
        <Title>Set up your profile</Title>
        <Muted>Dr Lucas uses this context to triage you safely.</Muted>
      </View>

      {/* Step 1 — Personal */}
      <View style={styles.stepLabel}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
        <Text style={styles.stepTitle}>Personal info</Text>
      </View>
      <View style={styles.card}>
        <Body>Full name *</Body>
        <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Body>Age</Body>
        <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 29" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Body>Blood type</Body>
        <TextInput value={bloodType} onChangeText={setBloodType} placeholder="e.g. O+" placeholderTextColor={colors.textMuted} style={styles.input} />
      </View>

      {/* Step 2 — Medical */}
      <View style={styles.stepLabel}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
        <Text style={styles.stepTitle}>Medical context</Text>
      </View>
      <View style={styles.card}>
        <Body>Allergies (comma-separated)</Body>
        <TextInput value={allergies} onChangeText={setAllergies} placeholder="penicillin, peanuts" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Body>Current medications</Body>
        <TextInput value={currentMedications} onChangeText={setCurrentMedications} placeholder="metformin, omeprazole" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Body>Chronic conditions</Body>
        <TextInput value={chronicConditions} onChangeText={setChronicConditions} placeholder="asthma, diabetes" placeholderTextColor={colors.textMuted} style={styles.input} />
      </View>

      {/* Step 3 — Emergency */}
      <View style={styles.stepLabel}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
        <Text style={styles.stepTitle}>Emergency contact</Text>
      </View>
      <View style={styles.card}>
        <Body>Contact name *</Body>
        <TextInput value={emergencyContactName} onChangeText={setEmergencyContactName} placeholder="Contact person" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Body>Contact phone *</Body>
        <TextInput value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} keyboardType="phone-pad" placeholder="+251..." placeholderTextColor={colors.textMuted} style={styles.input} />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Allow location access</Text>
            <Muted>Used for nearby care facility ranking.</Muted>
          </View>
          <Switch
            value={locationConsent}
            onValueChange={setLocationConsent}
            trackColor={{ true: colors.primary }}
            thumbColor={locationConsent ? '#FFFFFF' : colors.border}
          />
        </View>

        <Button onPress={handleSave}>{busy ? 'Saving…' : 'Finish setup'}</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoLetter: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.xs },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#FFFFFF', fontWeight: '700' },
  stepTitle: { fontSize: 18, color: colors.text, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
