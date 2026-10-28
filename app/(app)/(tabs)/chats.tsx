// Chat tab: every group chat you can open, latest activity first

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { GroupIcon, groupIconOf } from '../../../components/GroupIcon';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { firstName, formatMessageTime } from '../../../lib/format';
import type { ChatPreview } from '../../../lib/types';
import { Text } from '../../../components/Text';

export default function ChatsScreen() {
  const user = useAuth((state) => state.user)!;
  const chats = useAsync(() => api.getMyChats(user.id), [user.id], { refetchOnFocus: true });

  return (
    <Screen width="page">
      <ScrollView contentContainerClassName="flex-grow gap-5 px-4 pb-10 pt-4 wide:pt-8">
        <Text className="text-3xl font-bold text-ink">Chat</Text>

        {!chats.data && chats.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : chats.error ? (
          <Text className="text-red-600">{chats.error}</Text>
        ) : chats.data?.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Ionicons name="chatbubbles-outline" size={30} className="text-brand-600" />
            </View>
            <Text className="text-center text-lg font-semibold text-ink">Ancora nessuna chat</Text>
            <Text className="text-center text-stone-500">
              Quando un gruppo ti accetta, la sua chat compare qui.
            </Text>
            <Button title="Trova un gruppo" icon="people" onPress={() => router.navigate('/')} />
          </View>
        ) : (
          <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            {chats.data?.map((chat, index) => (
              <ChatRow key={chat.group.id} chat={chat} myId={user.id} first={index === 0} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ChatRow({ chat, myId, first }: { chat: ChatPreview; myId: string; first: boolean }) {
  const last = chat.last_message;
  const author = last ? (last.user_id === myId ? 'Tu' : firstName(last.author.full_name)) : null;

  return (
    <Link href={{ pathname: '/group/[id]/chat', params: { id: chat.group.id } }} asChild>
      <Pressable className={`flex-row items-center gap-3 p-4 active:bg-stone-100 ${first ? '' : 'border-t border-stone-100'}`}>
        <GroupIcon {...groupIconOf(chat.group)} size={52} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="flex-shrink text-base font-semibold text-ink">
              {chat.group.name}
            </Text>
            {chat.access === 'guest' ? <Badge label="Ospite" tone="sky" /> : null}
          </View>
          <Text numberOfLines={1} className="text-sm text-stone-500">
            {last ? `${author}: ${last.content}` : 'Nessun messaggio: rompi il ghiaccio!'}
          </Text>
        </View>
        {last ? <Text className="text-xs text-stone-400">{formatMessageTime(last.created_at)}</Text> : null}
      </Pressable>
    </Link>
  );
}
