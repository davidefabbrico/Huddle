// "Quando sei arrivato/a in città?" chips. Stores an approximate date (users.relocated_at).

import { View } from 'react-native';
import { arrivalOptionIndex, arrivalOptions, dateMonthsAgo } from '../lib/format';
import { Chip } from './Chip';
import { Text } from './Text';

interface Props {
  value: string | null;
  onChange: (date: string) => void;
}

export function ArrivalPicker({ value, onChange }: Props) {
  const selected = arrivalOptionIndex(value);
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-stone-700">Quando sei arrivato/a?</Text>
      <View className="flex-row flex-wrap gap-2">
        {arrivalOptions.map((option, index) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={selected === index}
            onPress={() => onChange(dateMonthsAgo(option.months))}
          />
        ))}
      </View>
    </View>
  );
}
