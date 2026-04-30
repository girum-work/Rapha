import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Body, Button, Muted, Screen, Section, Title } from '../../src/components/ui';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, radius, spacing } from '../../src/theme';

export default function AccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!hasSupabaseConfig || !supabase) {
      Alert.alert('Local demo', 'Add Supabase keys to .env to enable sign-in.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    Alert.alert(error ? 'Sign-in failed' : 'Signed in', error?.message ?? 'Rapha can now load your profile and sessions.');
  }

  async function signUp() {
    if (!hasSupabaseConfig || !supabase) {
      Alert.alert('Local demo', 'Add Supabase keys to .env to enable sign-up.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    Alert.alert(error ? 'Sign-up failed' : 'Check your email', error?.message ?? 'Confirm your email to activate the account.');
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <View style={styles.row}>
            <Title>Account</Title>
            <Badge tone={hasSupabaseConfig ? 'success' : 'warning'}>{hasSupabaseConfig ? 'Connected' : 'Local demo'}</Badge>
          </View>
          <Muted>Supabase auth protects medical profiles, session history, reminders, prescriptions, and service requests.</Muted>
        </Section>

        <Section>
          <Body>Email</Body>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Body>Password</Body>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.buttons}>
            <Button onPress={signIn}>{busy ? 'Working' : 'Sign in'}</Button>
            <Button variant="secondary" onPress={signUp}>
              Create account
            </Button>
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  buttons: {
    gap: spacing.sm,
  },
});
