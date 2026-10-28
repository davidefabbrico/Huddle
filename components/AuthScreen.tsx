// Wrapper for login, signup and password pages. On a computer: a brand panel on the left (what
// Huddle does) and the form on the right; on phones it's a plain Screen.

import type { ComponentProps, ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsWide } from '../hooks/useLayout';
import { Screen } from './Screen';

const highlights: { icon: ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'people', text: 'Entra in gruppi che esistono già, o porta qui il tuo' },
  { icon: 'calendar', text: 'Eventi, anche ricorrenti: rispondi “Ci sono” e sai su chi contare' },
  { icon: 'car', text: 'Passaggi tra amici e parcheggio con SmartPark' },
  { icon: 'sparkles', text: 'Suggerimenti “Per te” da chi ha i tuoi gusti' },
];

export function AuthScreen({ children }: { children: ReactNode }) {
  const wide = useIsWide();
  if (!wide) return <Screen>{children}</Screen>;

  return (
    <View className="flex-1 flex-row bg-surface">
      <View className="flex-1 justify-center gap-8 bg-brand-200 px-16">
        <View className="flex-row items-center gap-4">
          <Image source={require('../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 20 }} accessibilityIgnoresInvertColors />
          <Text className="text-5xl font-bold text-brand-800">Huddle</Text>
        </View>
        <Text className="max-w-md text-2xl font-semibold leading-9 text-brand-800">
          Organizza eventi con i tuoi gruppi e conosci gente nuova.
        </Text>
        <View className="max-w-md gap-4">
          {highlights.map((item) => (
            <View key={item.icon} className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white/70">
                <Ionicons name={item.icon} size={20} className="text-brand-600" />
              </View>
              <Text className="flex-1 text-base text-brand-800">{item.text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="flex-1">
        <View className="w-full max-w-lg flex-1 self-center">{children}</View>
      </View>
    </View>
  );
}
