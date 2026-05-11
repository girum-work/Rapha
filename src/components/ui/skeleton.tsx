import { Skeleton as MotiSkeleton } from 'moti/skeleton';

export function Skeleton({
  width,
  height,
  radius = 8,
}: {
  width: number | string;
  height: number;
  radius?: number;
}) {
  return <MotiSkeleton colorMode="dark" radius={radius} height={height} width={width as never} />;
}

