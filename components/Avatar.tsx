// Initials avatar with a stable pastel color per name (no photos in the MVP)

import { Text, View } from 'react-native';
import { initials } from '../lib/format';

const palette = ['bg-orange-200', 'bg-sky-200', 'bg-emerald-200', 'bg-violet-200', 'bg-rose-200', 'bg-amber-200'];

function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View
      className={`items-center justify-center rounded-full ${colorFor(name)}`}
      style={{ width: size, height: size }}
    >
      <Text className="font-semibold text-ink" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
