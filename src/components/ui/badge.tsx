import { Text, View } from 'react-native';

import { cn } from '../../lib/utils';

interface BadgeProps {
  children: string;
  variant?: 'default' | 'critical' | 'urgent' | 'mild' | 'info';
  className?: string;
}

const badgeVariants = {
  default: 'bg-muted',
  critical: 'bg-destructive/20 border border-destructive/30',
  urgent: 'bg-yellow-500/20 border border-yellow-500/30',
  mild: 'bg-primary/20 border border-primary/30',
  info: 'bg-blue-500/20 border border-blue-500/30',
} as const;

const textVariants = {
  default: 'text-muted-foreground',
  critical: 'text-red-400',
  urgent: 'text-yellow-400',
  mild: 'text-primary',
  info: 'text-blue-400',
} as const;

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <View className={cn('rounded-full px-3 py-1 self-start', badgeVariants[variant], className)}>
      <Text className={cn('text-xs font-semibold', textVariants[variant])}>{children}</Text>
    </View>
  );
}

