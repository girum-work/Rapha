import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Ambulance, Eye, EyeOff, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { type SignInForm, signInSchema } from '../src/lib/schemas';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, fonts, radius, spacing, typography } from '../src/theme';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [ambModal, setAmbModal] = useState(false);
  const [ambKey, setAmbKey] = useState('');
  const [ambBusy, setAmbBusy] = useState(false);
  const [ambError, setAmbError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function signIn(data: SignInForm) {
    setError('');
    if (!hasSupabaseConfig || !supabase) {
      setError('App configuration is incomplete. Please try again later.');
      return;
    }
    const emailTrim = data.email.trim();
    try {
      const { data: authData, error: signErr } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: data.password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }

      let activeSession: Session | null = authData.session ?? null;
      if (!activeSession) {
        const { data: refreshed, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        activeSession = refreshed.session ?? null;
      }
      if (!activeSession) {
        setError('Confirm your email first, then sign in.');
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', activeSession.user.id)
        .maybeSingle();
      if (profileError) {
        setError(profileError.message);
        return;
      }

      router.replace(profileRow ? '/(drawer)/dashboard' : '/onboarding');
    } finally {
      // react-hook-form handles submitting state
    }
  }

  async function ambulanceSignIn() {
    setAmbError('');
    const key = ambKey.trim().toUpperCase();
    if (!key) { setAmbError('Enter your service key.'); return; }
    setAmbBusy(true);
    try {
      const { data, error: dbErr } = await supabase!
        .from('ambulance_devices')
        .select('id, pairing_code, vehicle_plate, hospital_name, driver_name, driver_phone, is_active')
        .eq('pairing_code', key)
        .maybeSingle();
      if (dbErr || !data) { setAmbError('Invalid service key. Contact your coordinator.'); return; }
      if (!(data as { is_active: boolean }).is_active) { setAmbError('This device has been deactivated.'); return; }
      await AsyncStorage.setItem('rapha_mode', 'ambulance');
      await AsyncStorage.setItem('rapha_ambulance_device', JSON.stringify(data));
      setAmbModal(false);
      router.replace('/(ambulance)/home');
    } finally {
      setAmbBusy(false);
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
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.lead}>Sign in to continue</Text>

            <Text style={styles.label}>Email address</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textTertiary}
                />
              )}
            />
            {errors.email?.message ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    style={styles.inputPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textTertiary}
                  />
                )}
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
            {errors.password?.message ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
              onPress={handleSubmit(signIn)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerOr}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/sign-up')}>
              <Text style={styles.secondaryBtnText}>Create new account</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerOr}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.ambulanceBtn} onPress={() => setAmbModal(true)}>
              <Ambulance size={18} color="#DC2626" strokeWidth={2} />
              <Text style={styles.ambulanceBtnText}>Sign in as ambulance service</Text>
            </Pressable>
          </View>

          {/* Ambulance service modal */}
          <Modal visible={ambModal} animationType="slide" transparent onRequestClose={() => setAmbModal(false)}>
            <Pressable style={styles.ambOverlay} onPress={() => setAmbModal(false)} />
            <View style={styles.ambSheet}>
              <Text style={styles.ambTitle}>🚑 Rapha Service Login</Text>
              <Text style={styles.ambSub}>Enter your Rapha Service Key to access ambulance mode</Text>
              <TextInput
                value={ambKey}
                onChangeText={setAmbKey}
                placeholder="RA-XXXXXXXX"
                placeholderTextColor="#4B5563"
                autoCapitalize="characters"
                style={styles.ambInput}
              />
              {ambError ? <Text style={styles.ambError}>{ambError}</Text> : null}
              <Pressable style={styles.ambBtn} onPress={() => void ambulanceSignIn()} disabled={ambBusy}>
                {ambBusy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.ambBtnText}>Activate Service Mode</Text>
                }
              </Pressable>
            </View>
          </Modal>

          <Text style={[styles.legal, { marginBottom: insets.bottom > 0 ? 0 : spacing.md }]}>
            By continuing you agree to our Terms and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  top: {
    flexGrow: 0.35,
    minHeight: 220,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceDark,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceDarkElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceDarkSoft,
  },
  brand: {
    ...typography.authBrand,
    fontFamily: fonts.display,
    color: colors.onDark,
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.authTagline,
    fontFamily: fonts.body,
    color: colors.onDarkSoft,
    marginTop: spacing.xs,
  },
  form: {
    flexGrow: 0.65,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.canvas,
  },
  welcome: {
    ...typography.authWelcome,
    fontFamily: fonts.displayRegular,
    marginBottom: spacing.xs,
  },
  lead: {
    ...typography.authLead,
    fontFamily: fonts.body,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  passwordRow: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  inputPassword: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    paddingRight: 48,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.error,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.error,
    marginTop: -6,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fonts.bodyMedium,
    color: colors.onPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dividerOr: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.mutedSoft,
  },
  secondaryBtn: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
  legal: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.mutedSoft,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    lineHeight: 18,
  },
  ambulanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.4)',
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  ambulanceBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  ambOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  ambSheet: {
    backgroundColor: '#0A0F1C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  ambTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9' },
  ambSub: { fontSize: 13, color: '#94A3B8', lineHeight: 19 },
  ambInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    borderRadius: 12,
    padding: 14,
    color: '#F1F5F9',
    fontSize: 16,
    letterSpacing: 3,
    fontFamily: fonts.body,
  },
  ambError: { fontSize: 13, color: '#DC2626' },
  ambBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ambBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
