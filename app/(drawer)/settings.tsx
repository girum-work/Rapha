import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Badge, Body, Button, Muted, Screen, Section, Title } from '../../src/components/ui';
import { hasSupabaseConfig } from '../../src/lib/supabase';
import { colors, radius, spacing } from '../../src/theme';

export default function SettingsScreen() {
  const [locationConsent, setLocationConsent] = useState(true);
  const [profile, setProfile] = useState({
    allergies: '',
    medications: '',
    bloodType: '',
    emergencyContact: '',
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <View style={styles.row}>
            <Title>Settings</Title>
            <Badge tone={hasSupabaseConfig ? 'success' : 'warning'}>{hasSupabaseConfig ? 'Supabase ready' : 'Local demo'}</Badge>
          </View>
          <Muted>These fields become the medical context injected into Dr Lucas requests after Supabase is configured.</Muted>
        </Section>

        <Section>
          <Body>Medical profile</Body>
          <ProfileInput label="Allergies" value={profile.allergies} onChangeText={(allergies) => setProfile({ ...profile, allergies })} />
          <ProfileInput
            label="Current medications"
            value={profile.medications}
            onChangeText={(medications) => setProfile({ ...profile, medications })}
          />
          <ProfileInput label="Blood type" value={profile.bloodType} onChangeText={(bloodType) => setProfile({ ...profile, bloodType })} />
          <ProfileInput
            label="Emergency contact"
            value={profile.emergencyContact}
            onChangeText={(emergencyContact) => setProfile({ ...profile, emergencyContact })}
          />
        </Section>

        <Section>
          <View style={styles.row}>
            <Body>Allow location for facility ranking</Body>
            <Switch value={locationConsent} onValueChange={setLocationConsent} trackColor={{ true: colors.primarySoft }} thumbColor={colors.primary} />
          </View>
          <Muted>When disabled, Rapha uses Addis Ababa demo coordinates and asks again before live map search.</Muted>
        </Section>

        <Section>
          <Button onPress={() => undefined}>Save profile draft</Button>
          <Muted>Persistence to `profiles` is activated once Supabase keys are set in `.env`.</Muted>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function ProfileInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Body>{label}</Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
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
});
