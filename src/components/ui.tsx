import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Section({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.section, style]}>{children}</View>;
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
}: { children: ReactNode; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }) {
  const content =
    typeof children === 'string' ? (
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{children}</Text>
    ) : (
      children
    );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, buttonStyles[variant], pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    borderColor: '#fecaca',
  },
  warning: {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    borderColor: '#fed7aa',
  },
  success: {
    backgroundColor: colors.successSoft,
    color: colors.success,
    borderColor: '#bbf7d0',
  },
});

const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButtonText: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.78,
  },
});
