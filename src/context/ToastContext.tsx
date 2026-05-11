import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, MotiView } from 'moti';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const hide = useCallback(() => {
    setMessage(null);
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'info') => {
      setToastType(type);
      setMessage(msg);
    },
    [],
  );

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2500);
    return () => clearTimeout(t);
  }, [message, hide]);

  const bg =
    toastType === 'success'
      ? 'bg-emerald-500'
      : toastType === 'error'
        ? 'bg-red-500'
        : 'bg-sky-500';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {message ? (
          <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 z-50 items-center">
            <MotiView
              from={{ translateY: -100, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              exit={{ translateY: -100, opacity: 0 }}
              transition={{ type: 'timing', duration: 220 }}
              style={{ paddingTop: insets.top + 8 }}
              className="w-full items-center"
            >
              <Pressable onPress={hide} className={`max-w-[92%] rounded-2xl px-4 py-3 ${bg}`}>
                <Text className="text-center text-[13px] font-semibold text-white">{message}</Text>
              </Pressable>
            </MotiView>
          </View>
        ) : null}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
