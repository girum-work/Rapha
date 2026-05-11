import * as React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { MotiView } from 'moti';

import { cn } from '../../lib/utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
}: ButtonProps) {
  const [pressed, setPressed] = React.useState(false);

  const variantStyles: Record<Variant, string> = {
    primary: 'bg-primary',
    outline: 'border border-primary bg-transparent',
    ghost: 'bg-transparent',
    destructive: 'bg-destructive',
  };

  const sizeStyles: Record<Size, string> = {
    sm: 'px-4 py-2 rounded-xl',
    md: 'px-6 py-4 rounded-2xl',
    lg: 'px-8 py-5 rounded-2xl',
  };

  const textVariant: Record<Variant, string> = {
    primary: 'text-primary-foreground',
    outline: 'text-primary',
    ghost: 'text-foreground',
    destructive: 'text-destructive-foreground',
  };

  return (
    <MotiView animate={{ scale: pressed ? 0.96 : 1 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled || loading}
        className={cn(
          'items-center justify-center flex-row gap-2',
          variantStyles[variant],
          sizeStyles[size],
          (disabled || loading) && 'opacity-50',
          className,
        )}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? 'white' : '#00C2A8'} size="small" />
        ) : (
          <Text className={cn('font-semibold text-[15px]', textVariant[variant])}>{children}</Text>
        )}
      </Pressable>
    </MotiView>
  );
}

