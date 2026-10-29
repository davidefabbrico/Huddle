// User avatar: photo if `url` is set, else a GitHub-style pixel avatar if `seed` is set,
// else initials on a stable pastel color.

import { Image, View } from 'react-native';
import { initials } from '../lib/format';
import { identicon } from '../lib/identicon';
import type { User } from '../lib/types';
import { Text } from './Text';

const palette = ['bg-orange-200', 'bg-sky-200', 'bg-emerald-200', 'bg-violet-200', 'bg-rose-200', 'bg-amber-200'];

function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

interface Props {
  name: string;
  url?: string | null;
  seed?: string | null;
  size?: number;
}

// Avatar props from a user row: <Avatar {...avatarOf(user)} size={40} />
export function avatarOf(user: Pick<User, 'full_name' | 'avatar_url' | 'avatar_seed'>) {
  return { name: user.full_name, url: user.avatar_url, seed: user.avatar_seed };
}

export function Avatar({ name, url, seed, size = 40 }: Props) {
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.1) };

  if (url) {
    return <Image source={{ uri: url }} style={box} accessibilityLabel={name} />;
  }

  if (seed) {
    return <PixelAvatar seed={seed} size={size} />;
  }

  return (
    <View className={`items-center justify-center rounded-full ${colorFor(name)}`} style={box}>
      {/* dark on the pastel circle, also at night */}
      <Text className="font-semibold text-[#1F2430]" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

// 5x5 mirrored pixel grid on a light square tile (the grid stays inside the tile)
export function PixelAvatar({ seed, size }: { seed: string; size: number }) {
  const { color, cells } = identicon(seed);
  const cell = (size * 0.62) / 5;
  return (
    <View
      className="items-center justify-center rounded-full bg-stone-100"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.1) }}
    >
      {cells.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((on, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: on ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
