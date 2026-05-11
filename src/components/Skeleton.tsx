import { MotiView } from 'moti';
import type { ViewStyle } from 'react-native';

type Props = {
  width: ViewStyle['width'];
  height: number;
  radius?: number;
};

export function Skeleton({ width, height, radius = 8 }: Props) {
  return (
    <MotiView
      style={{ width, height, borderRadius: radius }}
      className="bg-border"
      from={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ type: 'timing', duration: 1600, loop: true }}
    />
  );
}
