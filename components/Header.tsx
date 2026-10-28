// Material 3 small top app bar: back arrow, title, optional actions. Falls back to Home when there is no history (e.g. a web deep link).

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
    <View className="h-16 flex-row items-center gap-1 bg-surface px-1">
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Indietro"
        hitSlop={8}
        className="h-12 w-12 items-center justify-center rounded-full active:bg-stone-200"
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-lg font-medium text-ink">
          {title}
        </Text>
        {subtitle ? <Text numberOfLines={1} className="text-xs text-stone-500">{subtitle}</Text> : null}
      </View>
      {right ? <View className="pr-3">{right}</View> : null}
    </View>
  );
}
