import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../theme';

export type ToastType = 'success' | 'error' | 'info';

type ToastContextValue = { showToast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('info');
  const slide = useRef(new Animated.Value(-100)).current;

  const hide = useCallback(() => {
    Animated.timing(slide, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => {
      setMessage(null);
    });
  }, [slide]);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'info') => {
      setToastType(type);
      setMessage(msg);
    },
    [],
  );

  useEffect(() => {
    if (!message) return;
    slide.setValue(-100);
    Animated.timing(slide, { toValue: 0, duration: 240, useNativeDriver: true }).start();
    const t = setTimeout(hide, 2500);
    return () => clearTimeout(t);
  }, [message, hide, slide]);

  const bg =
    toastType === 'success' ? colors.success : toastType === 'error' ? colors.error : colors.info;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              paddingTop: insets.top + spacing.sm,
              transform: [{ translateY: slide }],
            },
          ]}
        >
          <Pressable style={[styles.bar, { backgroundColor: bg }]} onPress={hide}>
            <Text style={styles.text}>{message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  bar: {
    maxWidth: '92%',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: {
    ...typography.bodySmall,
    color: colors.textOnAccent,
    fontWeight: '600',
    textAlign: 'center',
  },
});
