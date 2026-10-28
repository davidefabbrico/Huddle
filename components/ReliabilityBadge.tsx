// Reliability of a person or group, from their points (lib/reliability.ts): pixel stars and the level's
// name. The badge is hidden at the first level; PixelStars is also used on your profile.

import { View } from 'react-native';
import { reliabilityFor } from '../lib/reliability';
import { PixelIcon } from './PixelIcon';
import { Text } from './Text';

// Three pixel stars, gold up to the level ("★★☆"); the rest light grey
export function PixelStars({ stars, size = 12 }: { stars: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5" accessibilityLabel={`${stars} stelle su 3`}>
      {[1, 2, 3].map((n) => (
        <PixelIcon key={n} name="star" size={size} className={n <= stars ? 'text-amber-500' : 'text-stone-300'} />
      ))}
    </View>
  );
}

export function ReliabilityBadge({ points, centered = false }: { points: number | undefined; centered?: boolean }) {
  if (points === undefined) return null;
  const level = reliabilityFor(points);
  if (!level.stars) return null;
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full bg-brand-100 px-2 py-0.5 ${centered ? 'self-center' : 'self-start'}`}>
      <PixelStars stars={level.stars} size={11} />
      <Text className="text-xs font-semibold text-brand-700">{level.label}</Text>
    </View>
  );
}
