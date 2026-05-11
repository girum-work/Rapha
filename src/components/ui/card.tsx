import * as React from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }: ViewProps & { className?: string }) {
  return (
    <View className={cn('bg-card rounded-2xl border border-border p-4', className)} {...props}>
      {children}
    </View>
  );
}

