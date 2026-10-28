// Shown when the Supabase URL/key env vars are missing (see README → Supabase)

import { Text, View } from 'react-native';

export function SetupNeeded() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
      <Text className="text-center text-2xl font-pixel-bold text-ink">Supabase non configurato</Text>
      <Text className="text-center text-base text-stone-600">
        Imposta EXPO_PUBLIC_SUPABASE_URL ed EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (in locale) o nelle
        variabili di GitHub Actions (sito), poi riavvia.
      </Text>
    </View>
  );
}
