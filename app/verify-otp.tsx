import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { createRef, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors, fonts, radius, spacing, typography } from '../src/theme';

const CELL = 46;
const CELL_H = 54;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const inputRefs = useMemo(
    () => Array.from({ length: 6 }, () => createRef<RNTextInput>()),
    [],
  );

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focusIdx, setFocusIdx] = useState<number | null>(0);
  const shake = useRef(new Animated.Value(0)).current;

  const runShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const handleVerify = useCallback(
    async (code: string) => {
      if (!hasSupabaseConfig || !supabase || !email) {
        setError('Something went wrong. Go back and try again.');
        runShake();
        return;
      }
      setBusy(true);
      setError('');
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });
      setBusy(false);
      if (verifyErr) {
        setError(verifyErr.message);
        runShake();
        return;
      }
      router.replace('/onboarding');
    },
    [email, router, runShake],
  );

  const handleOtpChange = useCallback(
    (raw: string, index: number) => {
      const digits = raw.replace(/\D/g, '');
      if (digits.length > 1) {
        const chars = digits.slice(0, 6).split('');
        const next = [...otp];
        for (let i = 0; i < 6; i += 1) next[i] = chars[i] ?? '';
        setOtp(next);
        const lastIdx = Math.min(chars.length, 5);
        inputRefs[lastIdx]?.current?.focus();
        if (chars.length >= 6) void handleVerify(chars.join('').slice(0, 6));
        return;
      }
      const value = digits.slice(-1) ?? '';
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < 5) {
        inputRefs[index + 1]?.current?.focus();
      }
      const joined = newOtp.join('');
      if (joined.length === 6 && newOtp.every((d) => d !== '')) {
        void handleVerify(joined);
      }
    },
    [handleVerify, inputRefs, otp],
  );

  const onKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs[index - 1]?.current?.focus();
      }
    },
    [inputRefs, otp],
  );

  async function resend() {
    if (!hasSupabaseConfig || !supabase || !email) return;
    setError('');
    const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email });
    if (resendErr) setError(resendErr.message);
  }

  const complete = otp.every((d) => d !== '');

  return (
    <ScreenErrorBoundary>
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          accessibilityRole="button"
          hitSlop={16}
          style={styles.back}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>

        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Mail size={36} color={colors.textOnAccent} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.grey}>We sent a 6-digit code to</Text>
          <Text style={styles.email}>{email || 'your email'}</Text>
          <Pressable onPress={() => router.replace('/sign-up')}>
            <Text style={styles.wrongEmail}>Wrong email? Go back</Text>
          </Pressable>

          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shake }] }]}>
            {otp.map((digit, index) => {
              const focused = focusIdx === index;
              const filled = digit.length > 0;
              return (
                <TextInput
                  key={index}
                  ref={inputRefs[index]}
                  value={digit}
                  onChangeText={(t) => handleOtpChange(t, index)}
                  onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key, index)}
                  onFocus={() => setFocusIdx(index)}
                  onBlur={() => setFocusIdx((f) => (f === index ? null : f))}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? 6 : 1}
                  style={[
                    styles.cell,
                    focused && styles.cellFocus,
                    filled && styles.cellFilled,
                    error ? styles.cellError : null,
                  ]}
                  textAlign="center"
                  selectionColor={colors.accent}
                />
              );
            })}
          </Animated.View>

          {error ? <Text style={styles.errMsg}>{error}</Text> : null}

          <Pressable
            style={[styles.verifyBtn, (!complete || busy) && styles.verifyBtnDisabled]}
            disabled={!complete || busy}
            onPress={() => void handleVerify(otp.join(''))}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.verifyText}>Verify code</Text>
            )}
          </Pressable>

          <Text style={styles.resendLead}>Didn&apos;t get a code?</Text>
          <Pressable onPress={resend}>
            <Text style={styles.resendLink}>Resend code</Text>
          </Pressable>
        </View>
      </View>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  back: { alignSelf: 'flex-start', padding: spacing.xs },
  center: { flex: 1, alignItems: 'center', paddingTop: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 24,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
    marginTop: spacing.lg,
  },
  grey: {
    ...typography.authLead,
    fontFamily: fonts.body,
    marginTop: spacing.sm,
  },
  email: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: fonts.bodySemiBold,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  wrongEmail: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl + spacing.sm,
  },
  cell: {
    width: CELL,
    height: CELL_H,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...typography.otpDigit,
    fontFamily: fonts.bodySemiBold,
  },
  cellFocus: { borderColor: colors.accent },
  cellFilled: { borderColor: colors.primary, backgroundColor: colors.surface },
  cellError: { borderColor: colors.error },
  errMsg: {
    marginTop: spacing.md,
    fontSize: typography.bodySmall.fontSize,
    fontFamily: fonts.body,
    color: colors.error,
    textAlign: 'center',
  },
  verifyBtn: {
    marginTop: spacing.xl + spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    minWidth: '88%',
    alignItems: 'center',
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyText: {
    ...typography.authCta,
    fontFamily: fonts.bodySemiBold,
    color: colors.textOnAccent,
  },
  resendLead: {
    marginTop: spacing.lg,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.body,
    color: colors.textSecondary,
  },
  resendLink: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.bodySemiBold,
    color: colors.accent,
  },
});
