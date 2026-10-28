// Group lobby/chat. Only members, guests and accepted requesters get in.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, avatarOf } from '../../../../components/Avatar';
import { RelocatedBadge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { ExternalChatButton } from '../../../../components/ExternalChatButton';
import { GroupIcon } from '../../../../components/GroupIcon';
import { GroupTheme } from '../../../../components/GroupTheme';
import { Header } from '../../../../components/Header';
import { Screen } from '../../../../components/Screen';
import { bottomPadding } from '../../../../components/safeArea';
import { colors } from '../../../../components/theme';
import { useAsync } from '../../../../hooks/useAsync';
import { useAuth } from '../../../../hooks/useAuth';
import { useChat } from '../../../../hooks/useChat';
import * as api from '../../../../lib/api';
import { formatEventDate, formatMessageTime, tripDatesLabel } from '../../../../lib/format';
import type { ChatMessageWithAuthor, EventWithGroup } from '../../../../lib/types';

export default function GroupChatScreen() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const user = useAuth((state) => state.user)!;
  const insets = useSafeAreaInsets();

  const info = useAsync(async () => {
    const [group, allowed, request, chatLink] = await Promise.all([
      api.getGroupById(id),
      api.canAccessChat(id),
      api.getJoinRequest(user.id, id),
      api.getGroupLinks(id).then((links) => links.chat_url),
    ]);
    return { group, allowed, isGuest: request?.status === 'guest', chatLink };
  }, [id, user.id]);

  const allowed = info.data?.allowed ?? false;
  const { messages, loading, send } = useChat(id, allowed);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessageWithAuthor>>(null);

  // Keep the newest message in view
  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await send(user.id, text);
  }

  const title = info.data?.group?.name ?? 'Chat';

  if (!info.data) {
    return (
      <Screen width="page">
        <Header title={title} />
        <ActivityIndicator color={colors.brand} className="mt-10" />
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen width="page">
        <Header title={title} />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-stone-200">
            <Ionicons name="lock-closed" size={28} color={colors.muted} />
          </View>
          <Text className="text-center text-lg font-semibold text-ink">La chat è riservata al gruppo</Text>
          <Text className="text-center text-stone-500">Chiedi di unirti: appena ti accettano potrai scrivere qui.</Text>
          <Button
            title="Torna al gruppo"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/group/[id]', params: { id } })}
          />
        </View>
      </Screen>
    );
  }

  return (
    <GroupTheme group={info.data.group}>
      <Screen width="page">
        <Header
          title={title}
          subtitle={info.data.isGuest ? 'Sei ospite nella lobby' : undefined}
          right={info.data.chatLink ? <ExternalChatButton url={info.data.chatLink} compact /> : undefined}
        />
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {welcome ? (
            <View className="mx-4 mt-3 flex-row items-center gap-3 rounded-2xl bg-emerald-100 p-3">
              <Ionicons name="sparkles" size={20} color={colors.green} />
              <Text className="flex-1 text-sm text-emerald-800">
                Richiesta accettata! Presentati al gruppo con un messaggio.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.brand} className="mt-10" />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerClassName="gap-3 px-4 py-4"
              renderItem={({ item }) => <MessageBubble message={item} isMine={item.user_id === user.id} />}
              ListEmptyComponent={<Text className="text-center text-stone-500">Ancora nessun messaggio. Rompi il ghiaccio!</Text>}
            />
          )}

          <View
            className="flex-row items-center gap-2 bg-surface px-3 pt-2"
            style={bottomPadding(insets.bottom, 12)}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              submitBehavior="submit"
              returnKeyType="send"
              placeholder="Scrivi un messaggio…"
              placeholderTextColor="#A8A29E"
              className="h-11 flex-1 rounded-full bg-white px-4 text-base text-ink"
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Invia"
              className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() ? 'bg-brand-300 active:bg-brand-400' : 'bg-stone-200'}`}
            >
              <Ionicons name="send" size={18} color={draft.trim() ? colors.ink : colors.muted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    </GroupTheme>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessageWithAuthor; isMine: boolean }) {
  if (isMine) {
    return (
      <View className="max-w-[80%] self-end">
        {message.event ? (
          <SharedEvent event={message.event} />
        ) : (
          <View className="rounded-3xl rounded-br-md bg-brand-200 px-4 py-2.5">
            <Text className="text-base text-brand-800">{message.content}</Text>
          </View>
        )}
        <Text className="mt-1 self-end text-xs text-stone-400">{formatMessageTime(message.created_at)}</Text>
      </View>
    );
  }

  return (
    <View className="max-w-[85%] flex-row items-end gap-2 self-start">
      <Avatar {...avatarOf(message.author)} size={32} />
      <View className="flex-shrink">
        <View className="mb-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold text-stone-600">{message.author.full_name}</Text>
          {message.author.is_relocated ? <RelocatedBadge /> : null}
        </View>
        {message.event ? (
          <SharedEvent event={message.event} />
        ) : (
          <View className="rounded-3xl rounded-bl-md bg-white px-4 py-2.5">
            <Text className="text-base text-ink">{message.content}</Text>
          </View>
        )}
        <Text className="mt-1 text-xs text-stone-400">{formatMessageTime(message.created_at)}</Text>
      </View>
    </View>
  );
}

// An event or holiday shared in the chat: a small card that opens it (with its own group's colors)
function SharedEvent({ event }: { event: EventWithGroup }) {
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable className="w-64 gap-1 rounded-3xl bg-white p-3 active:bg-stone-100">
        <View className="flex-row items-center gap-2">
          <GroupIcon name={event.group_name} icon={event.group_icon} color={event.group_color} size={28} />
          <Text numberOfLines={1} className="flex-1 text-xs text-stone-500">
            {event.group_name}
          </Text>
        </View>
        <Text numberOfLines={2} className="text-base font-semibold text-ink">
          {event.kind === 'trip' ? '🏖️' : '📅'} {event.title}
        </Text>
        <Text className="text-sm text-stone-500">
          {event.kind === 'trip' ? tripDatesLabel(event.date_time, event.ends_at) : formatEventDate(event.date_time)}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
      </Pressable>
    </Link>
  );
}
