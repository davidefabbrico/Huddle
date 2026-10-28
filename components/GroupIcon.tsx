// Group "photo": the group's emoji on its colored tile (rounded like an app icon).
// Without a chosen icon, a suggestion from the group's name (lib/groupIcons.ts).

import { View } from 'react-native';
import { GROUP_COLORS, groupLook } from '../lib/groupIcons';
import { Text } from './Text';

interface Props {
  name: string;
  icon?: string | null;
  color?: string | null;
  size?: number;
}

// <GroupIcon {...groupIconOf(group)} size={40} />
export function groupIconOf(group: { name: string; icon?: string | null; color?: string | null }) {
  return { name: group.name, icon: group.icon, color: group.color };
}

export function GroupIcon({ name, icon, color, size = 48 }: Props) {
  const look = groupLook({ name, icon, color });
  return (
    <View
      className={`items-center justify-center ${GROUP_COLORS[look.color].tile}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.1) }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.54, lineHeight: size * 0.7 }}>{look.icon}</Text>
    </View>
  );
}
