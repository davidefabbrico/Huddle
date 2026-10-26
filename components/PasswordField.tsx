// Password input with a show/hide toggle

import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

interface Props extends TextInputProps {
  label: string;
}

export function PasswordField({ label, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-stone-700">{label}</Text>
      <View className="h-12 flex-row items-center rounded-2xl border border-stone-300 bg-white pl-4 pr-2">
        <TextInput
          placeholderTextColor="#A8A29E"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          className="h-full flex-1 text-base text-ink"
          {...inputProps}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Nascondi password' : 'Mostra password'}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-stone-100"
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
