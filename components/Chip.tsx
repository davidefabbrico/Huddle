// Filter chip, arcade style: square, outlined; pastel with the dark outline and a check when selected. Non-interactive when
// `onPress` is omitted. Colors follow the group (GroupTheme).

import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrand } from './GroupTheme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: Props) {
  const brand = useBrand();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'checkbox' : undefined}
      accessibilityLabel={label} // the check icon is decoration: the name stays the label
      accessibilityState={onPress ? { checked: selected } : undefined}
      // react-native-web ignores accessibilityState.checked: screen readers on the web need aria-checked
      aria-checked={onPress ? selected : undefined}
      className={`h-8 flex-row items-center gap-1 rounded-lg border-2 px-3 ${selected ? 'border-line bg-brand-200' : 'border-stone-300 bg-white active:bg-stone-100'}`}
    >
      {selected && onPress ? <Ionicons name="checkmark" size={14} color={brand[800]} /> : null}
      <Text className={`text-sm ${selected ? 'font-pixel text-brand-800' : 'text-stone-700'}`}>{label}</Text>
    </Pressable>
  );
}
