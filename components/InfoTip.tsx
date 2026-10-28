// A small ⓘ next to a label: tap it to read the explanation (screens stay clean, the help is one tap away)

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Nascondi la spiegazione' : 'Spiegazione'}
        hitSlop={10}
      >
        <Ionicons name={open ? 'information-circle' : 'information-circle-outline'} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View className="absolute right-0 top-6 z-10 w-64 rounded-2xl bg-ink px-3 py-2">
          <Text className="text-xs leading-5 text-white">{text}</Text>
        </View>
      ) : null}
    </View>
  );
}
