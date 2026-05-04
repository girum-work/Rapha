/**
 * Rapha UI tokens — Part 1 navy / teal system.
 * `fonts` stays on Expo Google Font names for root `useFonts` until fonts are dropped app-wide.
 */

export const colors = {
  // Primary
  primary: '#0A1628',
  primaryMid: '#1B3A6B',

  // Accent
  accent: '#00C2A8',
  accentLight: '#E6FAF8',
  accentDark: '#008F7A',

  // Severity
  emergency: '#DC2626',
  emergencyLight: '#FEF2F2',
  urgent: '#D97706',
  urgentLight: '#FFFBEB',
  mild: '#059669',
  mildLight: '#ECFDF5',
  info: '#3B82F6',
  infoLight: '#EFF6FF',

  // Neutrals
  surface: '#FFFFFF',
  background: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnAccent: '#FFFFFF',
  textOnEmergency: '#FFFFFF',

  // Chat bubbles
  drLucasBubble: '#0A1628',
  drLucasText: '#FFFFFF',
  userBubble: '#00C2A8',
  userText: '#FFFFFF',

  // —— Legacy aliases (screens not yet migrated to new names) ——
  canvas: '#F8FAFC',
  surfaceSoft: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  surfaceCreamStrong: '#E2E8F0',
  hairline: '#E2E8F0',
  hairlineSoft: '#F1F5F9',
  ink: '#0F172A',
  body: '#0F172A',
  bodyStrong: '#0F172A',
  muted: '#64748B',
  mutedSoft: '#94A3B8',
  primaryActive: '#008F7A',
  primaryDisabled: '#CBD5E1',
  onPrimary: '#FFFFFF',
  surfaceDark: '#0A1628',
  surfaceDarkElevated: '#1B3A6B',
  surfaceDarkSoft: '#1B3A6B',
  onDark: '#FFFFFF',
  onDarkSoft: '#94A3B8',
  accentTeal: '#00C2A8',
  accentAmber: '#D97706',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  surfaceMuted: '#F1F5F9',
  text: '#0F172A',
  textMuted: '#64748B',
  primarySoft: 'rgba(0, 194, 168, 0.18)',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warningSoft: '#FFFBEB',
  successSoft: '#ECFDF5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** @deprecated use `xs` — same value */
  xxs: 4,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  xs: 8,
  pill: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.textPrimary },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.textPrimary },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, color: colors.textSecondary },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary },
};

/** Loaded via `useFonts` in `app/_layout.tsx`. */
export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayRegular: 'CormorantGaramond_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;
