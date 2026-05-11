import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { type SignUpForm, signUpSchema } from '../src/lib/schemas';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors } from '../src/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function signUp(data: SignUpForm) {
    setError('');
    if (!hasSupabaseConfig || !supabase) {
      setError('App configuration is incomplete. Please try again later.');
      return;
    }
    const nameTrim = data.name.trim();
    const emailTrim = data.email.trim();
    try {
      const { data: authData, error: signErr } = await supabase.auth.signUp({
        email: emailTrim,
        password: data.password,
        options: { data: { full_name: nameTrim } },
      });
      if (signErr) { setError(signErr.message); return; }
      if (authData.session) { router.replace('/onboarding'); return; }
      router.replace({ pathname: '/verify-otp', params: { email: emailTrim } });
    } finally {
      // RHF handles submitting state
    }
  }

  return (
    <ScreenErrorBoundary>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="min-h-[200px] items-center justify-end px-6 pb-6">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
              <Stethoscope size={40} color={colors.textOnAccent} strokeWidth={2} />
            </View>
            <Text className="mt-4 text-[34px] font-semibold tracking-[-0.5px] text-foreground">Rapha</Text>
            <Text className="mt-2 text-[14px] text-foreground/70">Your AI health companion</Text>
          </View>

          <View className="px-6">
            <Text className="text-[22px] font-semibold text-foreground">Create account</Text>
            <Text className="mt-1 text-[14px] text-foreground/70">
              Join thousands of Ethiopians using Rapha
            </Text>

            <Text className="mt-6 mb-2 text-[12px] font-semibold text-foreground/80">Full name</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoComplete="name"
                  className="rounded-2xl border border-border bg-input px-4 py-4 text-[15px] text-foreground"
                  placeholder="Your full name"
                  placeholderTextColor={colors.textTertiary}
                />
              )}
            />
            {errors.name?.message ? (
              <Text className="mt-2 text-[12px] text-red-400">{errors.name.message}</Text>
            ) : null}

            <Text className="mt-4 mb-2 text-[12px] font-semibold text-foreground/80">Email address</Text>
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
                  className="rounded-2xl border border-border bg-input px-4 py-4 text-[15px] text-foreground"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textTertiary}
                />
              )}
            />
            {errors.email?.message ? (
              <Text className="mt-2 text-[12px] text-red-400">{errors.email.message}</Text>
            ) : null}

            <Text className="mt-4 mb-2 text-[12px] font-semibold text-foreground/80">Password</Text>
            <View className="relative">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    className="rounded-2xl border border-border bg-input px-4 py-4 pr-12 text-[15px] text-foreground"
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.textTertiary}
                  />
                )}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                className="absolute right-3 top-0 bottom-0 items-center justify-center"
                onPress={() => setShowPassword((v) => !v)}
              >
                {showPassword
                  ? <EyeOff size={22} color={colors.textSecondary} strokeWidth={2} />
                  : <Eye size={22} color={colors.textSecondary} strokeWidth={2} />
                }
              </Pressable>
            </View>
            {errors.password?.message ? (
              <Text className="mt-2 text-[12px] text-red-400">{errors.password.message}</Text>
            ) : null}

            <Text className="mt-4 mb-2 text-[12px] font-semibold text-foreground/80">Confirm password</Text>
            <View className="relative">
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showConfirm}
                    className="rounded-2xl border border-border bg-input px-4 py-4 pr-12 text-[15px] text-foreground"
                    placeholder="Repeat password"
                    placeholderTextColor={colors.textTertiary}
                  />
                )}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                className="absolute right-3 top-0 bottom-0 items-center justify-center"
                onPress={() => setShowConfirm((v) => !v)}
              >
                {showConfirm
                  ? <EyeOff size={22} color={colors.textSecondary} strokeWidth={2} />
                  : <Eye size={22} color={colors.textSecondary} strokeWidth={2} />
                }
              </Pressable>
            </View>
            {errors.confirmPassword?.message ? (
              <Text className="mt-2 text-[12px] text-red-400">{errors.confirmPassword.message}</Text>
            ) : null}

            {error ? <Text className="mt-4 text-[13px] text-red-400">{error}</Text> : null}

            <Pressable
              className={`mt-6 items-center rounded-2xl bg-primary py-4 ${isSubmitting ? 'opacity-70' : ''}`}
              onPress={handleSubmit(signUp)}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color={colors.textOnAccent} />
                : <Text className="text-[14px] font-semibold text-primary-foreground">Create account</Text>
              }
            </Pressable>
          </View>

          <Text className="mt-6 px-6 text-center text-[12px] text-foreground/60">
            By continuing you agree to our Terms and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenErrorBoundary>
  );
}
