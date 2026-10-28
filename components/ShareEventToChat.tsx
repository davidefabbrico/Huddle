// "Condividi" on a public event or holiday: pick one of your group chats and the event lands there
// as a card (the database refuses events that aren't public, so private ones can't leak).

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as api from '../lib/api';
import type { ChatPreview, EventWithGroup } from '../lib/types';
import { Button } from './Button';
import { GroupIcon, groupIconOf } from './GroupIcon';

export function ShareEventToChat({ event, myId }: { event: EventWithGroup; myId: string }) {
  const [chats, setChats] = useState<ChatPreview[] | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  async function open() {
    setError(undefined);
    try {
      setChats(await api.getMyChats(myId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat non disponibili');
    }
  }

  async function share(chat: ChatPreview) {
    setError(undefined);
    try {
      await api.sendMessage(chat.group.id, myId, `${event.kind === 'trip' ? '🏖️' : '📅'} ${event.title}`, event.id);
      setSentTo((ids) => [...ids, chat.group.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Condivisione non riuscita');
    }
  }

  if (!chats) return <Button title="Condividi in un gruppo" icon="share-outline" size="sm" variant="secondary" onPress={open} />;

  return (
    <View className="gap-2 rounded-2xl bg-brand-50 p-3">
      <Text className="text-sm font-semibold text-ink">In quale chat?</Text>
      {chats.length === 0 ? <Text className="text-sm text-stone-500">Non hai ancora chat di gruppo.</Text> : null}
      {chats.map((chat) => {
        const sent = sentTo.includes(chat.group.id);
        return (
          <Pressable
            key={chat.group.id}
            onPress={sent ? undefined : () => share(chat)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-xl bg-white px-3 py-2 active:bg-stone-100"
          >
            <GroupIcon {...groupIconOf(chat.group)} size={32} />
            <Text numberOfLines={1} className="flex-1 text-ink">
              {chat.group.name}
            </Text>
            <Text className={`text-sm font-semibold ${sent ? 'text-emerald-700' : 'text-brand-700'}`}>{sent ? 'Inviato ✓' : 'Invia'}</Text>
          </Pressable>
        );
      })}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
