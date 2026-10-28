// "Apri il gruppo su WhatsApp" (or Telegram, Signal, Discord…), in the app's brand color.
// `compact` renders just the round icon, for headers.

import { Linking, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detectChatApp } from '../lib/chatLinks';

export function ExternalChatButton({ url, compact = false }: { url: string; compact?: boolean }) {
  const app = detectChatApp(url);
  const open = () => Linking.openURL(url);

  if (compact) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={`Apri il gruppo su ${app.name}`}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:opacity-80"
        style={{ backgroundColor: app.color }}
      >
        <Ionicons name={app.icon} size={18} color="#FFFFFF" />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      className="h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-80"
      style={{ backgroundColor: app.color }}
    >
      <Ionicons name={app.icon} size={20} color="#FFFFFF" />
      <Text className="text-base font-semibold text-[#FFFFFF]">Apri il gruppo su {app.name}</Text>
    </Pressable>
  );
}
