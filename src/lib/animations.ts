import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const timings = {
  fast: { duration: 200, easing: Easing.out(Easing.cubic) },
  medium: { duration: 350, easing: Easing.out(Easing.cubic) },
  slow: { duration: 500, easing: Easing.inOut(Easing.cubic) },
  spring: { damping: 18, stiffness: 200, mass: 0.8 },
  springBouncy: { damping: 12, stiffness: 180, mass: 0.9 },
} as const;

export function useFadeIn(delayMs = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const start = () => {
    const fade = withTiming(1, timings.medium);
    const move = withSpring(0, timings.spring);
    opacity.value = delayMs > 0 ? withDelay(delayMs, fade) : fade;
    translateY.value = delayMs > 0 ? withDelay(delayMs, move) : move;
  };

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { style, start };
}

export function usePressAnimation() {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(0.96, timings.spring);
  };
  const onPressOut = () => {
    scale.value = withSpring(1, timings.springBouncy);
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { style, onPressIn, onPressOut };
}

export function usePulseGlow() {
  const glowOpacity = useSharedValue(0.4);

  const start = () => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  };

  const style = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return { style, start };
}

export function useSlideUp(fromY = 40) {
  const translateY = useSharedValue(fromY);
  const opacity = useSharedValue(0);

  const enter = () => {
    translateY.value = withSpring(0, timings.springBouncy);
    opacity.value = withTiming(1, timings.medium);
  };

  const exit = (callback?: () => void) => {
    translateY.value = withTiming(fromY, timings.fast);
    opacity.value = withTiming(0, timings.fast, (finished) => {
      if (finished && callback) runOnJS(callback)();
    });
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return { style, enter, exit };
}
