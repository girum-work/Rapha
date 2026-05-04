import { useRouter } from 'expo-router';
import { Eye, EyeOff, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, fonts, radius, spacing, typography } from '../src/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signUp() {
    setError('');
    if (!hasSupabaseConfig || !supabase) {
      setError('App configuration is incomplete. Please try again later.');
      return;
    }
    const nameTrim = fullName.trim();
    const emailTrim = email.trim();
    if (!nameTrim || !emailTrim || !password) {
      setError('Fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: { data: { full_name: nameTrim } },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      if (data.session) {
        router.replace('/onboarding');
        return;
      }
      router.replace({ pathname: '/verify-otp', params: { email: emailTrim } });
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <View style={styles.logoCircle}>
              <Stethoscope size={40} color={colors.textOnAccent} strokeWidth={2} />
            </View>
            <Text style={styles.brand}>Rapha</Text>
            <Text style={styles.tagline}>Your AI health companion</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.welcome}>Create account</Text>
            <Text style={styles.lead}>Join thousands of Ethiopians using Rapha</Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.inputPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textTertiary}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff size={22} color={colors.textSecondary} strokeWidth={2} />
                ) : (
                  <Eye size={22} color={colors.textSecondary} strokeWidth={2} />
                )}
              </Pressable>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                style={styles.inputPassword}
                placeholder="Repeat password"
                placeholderTextColor={colors.textTertiary}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? (
                  <EyeOff size={22} color={colors.textSecondary} strokeWidth={2} />
                ) : (
                  <Eye size={22} color={colors.textSecondary} strokeWidth={2} />
                )}
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              onPress={signUp}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Create account</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerOr}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/sign-in')}>
              <Text style={styles.secondaryBtnText}>Sign in instead</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>By continuing you agree to our Terms and Privacy Policy</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  top: {
    flexGrow: 0.3,
    minHeight: 200,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    ...typography.authBrand,
    fontFamily: fonts.bodySemiBold,
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.authTagline,
    fontFamily: fonts.body,
    marginTop: spacing.sm,
  },
  form: {
    flexGrow: 0.7,
    paddingHorizontal: spacing.lg,
  },
  welcome: {
    ...typography.authWelcome,
    fontFamily: fonts.bodySemiBold,
    marginBottom: spacing.xs,
  },
  lead: {
    ...typography.authLead,
    fontFamily: fonts.body,
    marginBottom: spacing.lg + spacing.xs,
  },
  label: {
    ...typography.label,
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  passwordRow: { position: 'relative', marginBottom: spacing.md },
  inputPassword: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    paddingRight: 48,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: fonts.body,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    ...typography.authCta,
    fontFamily: fonts.bodySemiBold,
    color: colors.textOnAccent,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerOr: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: fonts.body,
    color: colors.textTertiary,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...typography.authSecondaryCta,
    fontFamily: fonts.bodySemiBold,
  },
  legal: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
});
