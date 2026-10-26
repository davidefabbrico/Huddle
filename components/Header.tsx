// Top bar with a back button. Falls back to Home when there is no history (e.g. a web deep link).

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function Header({ title, subtitle, right }: Props) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View className="flex-row items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Indietro"
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full bg-stone-100 active:bg-stone-200"
      >
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {title}
        </Text>
        {subtitle ? <Text className="text-xs text-stone-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
