// Event poster ("locandina"): images are shown inline, PDFs as a card that opens the file.

import { Image, Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isPdf } from '../lib/pickers';
import { Text } from './Text';

export function PosterView({ url, mime }: { url: string; mime: string | null }) {
  const open = () => Linking.openURL(url);

  if (isPdf(mime)) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="link"
        className="flex-row items-center gap-3 rounded-3xl border border-stone-200 bg-white p-4 active:bg-stone-100"
      >
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <Ionicons name="document-text" size={26} color="#DC2626" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-ink">Locandina (PDF)</Text>
          <Text className="text-sm text-stone-500">Tocca per aprirla</Text>
        </View>
        <Ionicons name="open-outline" size={20} className="text-stone-500" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} accessibilityRole="imagebutton" accessibilityLabel="Locandina dell’evento">
      <Image
        source={{ uri: url }}
        resizeMode="contain"
        className="w-full rounded-3xl bg-stone-100"
        style={{ aspectRatio: 3 / 4 }}
      />
    </Pressable>
  );
}
