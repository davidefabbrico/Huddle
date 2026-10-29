// A panel over the page (dimmed behind): from the bottom on a phone, a box in the middle on a computer.
// Used by the ⓘ explanations (InfoTip) and by block / report / hide (SafetyActions). Always on top and
// never cut by the page around it.

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeVars } from './GroupTheme';
import { Text } from './Text';

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const theme = useThemeVars(); // the Modal is outside the themed views: light/dark and group colors come along
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end bg-black/40 wide:items-center wide:justify-center"
        style={theme}
        onPress={onClose}
        accessibilityLabel="Chiudi"
      >
        {/* taps inside don't close it */}
        <Pressable className="w-full gap-4 rounded-t-3xl bg-white p-5 pb-8 wide:max-w-md wide:rounded-3xl" onPress={() => {}}>
          <View className="flex-row items-center justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 text-lg font-semibold text-ink">
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={8}>
              <Ionicons name="close" size={22} className="text-stone-500" />
            </Pressable>
          </View>
          {/* long content (the rank ladder) scrolls inside */}
          <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerClassName="gap-3">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
