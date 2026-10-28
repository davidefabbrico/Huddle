// Arcade text field: square, with the dark pixel outline (label above)

import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label: string;
}

export function TextField({ label, ...inputProps }: Props) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-stone-700">{label}</Text>
      <TextInput
        placeholderTextColor="#A8A29E"
        className="h-12 w-full min-w-0 rounded-xl border-2 border-line bg-white px-4 text-base text-ink outline-none focus:border-brand-500"
        {...inputProps}
      />
    </View>
  );
}
