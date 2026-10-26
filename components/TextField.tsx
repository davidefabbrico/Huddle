// Labeled text input

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
        className="h-12 rounded-2xl border border-stone-300 bg-white px-4 text-base text-ink focus:border-brand-500"
        {...inputProps}
      />
    </View>
  );
}
