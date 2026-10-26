// Selectable pill (interests, intent). Non-interactive when `onPress` is omitted.

import { Pressable, Text } from 'react-native';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'checkbox' : undefined}
      accessibilityState={onPress ? { checked: selected } : undefined}
      className={`rounded-full border px-3 py-1.5 ${selected ? 'border-brand-500 bg-brand-500' : 'border-stone-300 bg-white'}`}
    >
      <Text className={`text-sm ${selected ? 'font-semibold text-white' : 'text-stone-700'}`}>{label}</Text>
    </Pressable>
  );
}
