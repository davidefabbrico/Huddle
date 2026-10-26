// Colored icon tile for a group. Picked from the group name for now;
// replace with a real category or cover image once groups have one.

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const keywordIcons: [RegExp, IconName][] = [
  [/run|corsa/i, 'walk'],
  [/board|gioc|game/i, 'dice'],
  [/padel|tennis/i, 'tennisball'],
  [/aperitivo|drink/i, 'wine'],
  [/hik|trek|montagna/i, 'trail-sign'],
  [/book|libr/i, 'book'],
];

export function GroupIcon({ name, size = 48 }: { name: string; size?: number }) {
  const icon = keywordIcons.find(([pattern]) => pattern.test(name))?.[1] ?? 'people';
  return (
    <View className="items-center justify-center rounded-2xl bg-brand-100" style={{ width: size, height: size }}>
      <Ionicons name={icon} size={size * 0.5} color={colors.brandDark} />
    </View>
  );
}
