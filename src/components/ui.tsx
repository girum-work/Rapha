import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, fonts, radius, spacing } from '../theme';

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Section({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.section, style]}>{children}</View>;
}

/** Serif display — use for hero / auth headlines (DESIGN display-sm scale on mobile). */
export function Display({ children }: PropsWithChildren) {
  return <Text style={styles.display}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Badge({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'danger' | 'warning' | 'success' }>) {
  return <Text style={[styles.badge, toneStyles[tone]]}>{children}</Text>;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const content =
    typeof children === 'string' ? (
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText, variant === 'danger' && styles.dangerButtonText]}>
        {children}
      </Text>
    ) : (
      children
    );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        pressed && variant === 'primary' && styles.primaryPressed,
        pressed && variant === 'secondary' && styles.secondaryPressed,
        pressed && variant === 'danger' && styles.dangerPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.surfaceCard,
    color: colors.muted,
    borderColor: colors.hairline,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    borderColor: colors.hairline,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    borderColor: colors.hairline,
  },
  success: {
    backgroundColor: colors.successSoft,
    color: colors.success,
    borderColor: colors.hairline,
  },
});

const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: spacing.md,
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  display: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.body,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 25,
  },
  muted: {
    fontFamily: fonts.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    overflow: 'hidden',
  },
  button: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.onPrimary,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
  },
  dangerButtonText: {
    color: colors.onPrimary,
  },
  primaryPressed: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accentDark,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  dangerPressed: {
    opacity: 0.88,
  },
});
