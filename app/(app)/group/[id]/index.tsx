// Group detail: description, join button, upcoming events, members.
// Join flow: "Chiedi di unirti" -> "In attesa…" -> (simulated acceptance) -> opens the chat.

import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar } from '../../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { EventCard } from '../../../../components/EventCard';
import { GroupIcon } from '../../../../components/GroupIcon';
import { Header } from '../../../../components/Header';
import { Screen } from '../../../../components/Screen';
import { colors } from '../../../../components/theme';
import { useAsync } from '../../../../hooks/useAsync';
import { useAuth } from '../../../../hooks/useAuth';
import { hasChatAccess, useJoinStore, type GroupAccess } from '../../../../hooks/useJoinStore';
import * as api from '../../../../lib/api';
import type { Group } from '../../../../lib/types';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user)!;
  const access = useJoinStore((state) => state.access[id] ?? 'loading');
  const loadAccess = useJoinStore((state) => state.load);

  const details = useAsync(async () => {
    const [group, members, events] = await Promise.all([
      api.getGroupById(id),
      api.getGroupMembers(id),
      api.getGroupEvents(id),
    ]);
    return { group, members, events };
  }, [id, access]); // refetch after joining so the member list updates

  useEffect(() => {
    loadAccess(user.id, id);
  }, [user.id, id, loadAccess]);

  // When a pending request gets accepted while we're here, go straight to the chat
  const previousAccess = useRef<GroupAccess>(access);
  useEffect(() => {
    if (previousAccess.current === 'pending' && access === 'accepted') {
      router.push({ pathname: '/group/[id]/chat', params: { id, welcome: '1' } });
    }
    previousAccess.current = access;
  }, [access, id]);

  const group = details.data?.group;

  if (!details.data) {
    return (
      <Screen>
        <Header title="Gruppo" />
        {details.error ? (
          <Text className="p-4 text-red-600">{details.error}</Text>
        ) : (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        )}
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen>
        <Header title="Gruppo" />
        <Text className="p-4 text-stone-600">Questo gruppo non esiste.</Text>
      </Screen>
    );
  }

  const { members, events } = details.data;

  return (
    <Screen>
      <Header title={group.name} subtitle={`${members.length} membri`} />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-5">
        <View className="items-center gap-2">
          <GroupIcon name={group.name} size={72} />
          <Text className="text-center text-2xl font-bold text-ink">{group.name}</Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <Text className="text-stone-500">{group.location}</Text>
          </View>
          {group.type === 'open_to_new' ? (
            <Badge label="Aperto a nuovi membri" tone="green" icon="checkmark-circle" centered />
          ) : (
            <Badge label="Al completo" icon="lock-closed" centered />
          )}
        </View>

        <Text className="text-base leading-6 text-stone-700">{group.description}</Text>

        <JoinSection group={group} access={access} onRequest={() => useJoinStore.getState().requestToJoin(user.id, id)} />

        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">Prossimi eventi</Text>
          {events.length === 0 ? (
            <Text className="text-stone-500">Nessun evento in programma.</Text>
          ) : (
            events.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">Membri ({members.length})</Text>
          <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            {members.map((member, index) => (
              <View
                key={member.id}
                className={`flex-row gap-3 p-4 ${index > 0 ? 'border-t border-stone-100' : ''}`}
              >
                <Avatar name={member.full_name} />
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-semibold text-ink">
                      {member.full_name}
                      {member.id === user.id ? ' (tu)' : ''}
                    </Text>
                    {member.member_role === 'admin' ? <Badge label="Admin" tone="brand" icon="star" /> : null}
                    {member.is_relocated ? <RelocatedBadge /> : null}
                  </View>
                  <Text numberOfLines={2} className="text-sm text-stone-500">
                    {member.bio}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// The call-to-action, which depends on the user's access to the group
function JoinSection({ group, access, onRequest }: { group: Group; access: GroupAccess; onRequest: () => void }) {
  const openChat = () => router.push({ pathname: '/group/[id]/chat', params: { id: group.id } });

  if (access === 'loading') return <Button title="Caricamento…" variant="muted" disabled />;

  if (hasChatAccess(access)) {
    return (
      <Button
        title={access === 'guest' ? 'Sei ospite · Apri la lobby' : 'Apri la chat del gruppo'}
        icon="chatbubbles"
        onPress={openChat}
      />
    );
  }

  if (access === 'pending') {
    return (
      <View className="gap-2">
        <Button title="In attesa di risposta…" icon="hourglass-outline" variant="muted" disabled />
        <Text className="text-center text-sm text-stone-500">
          Abbiamo avvisato l’admin. Ti portiamo in chat appena accetta.
        </Text>
      </View>
    );
  }

  if (group.type === 'closed') {
    return <Button title="Il gruppo al momento è al completo" icon="lock-closed" variant="muted" disabled />;
  }

  // 'none' or 'rejected' (a rejected user may ask again)
  return (
    <View className="gap-2">
      <Button title="Chiedi di unirti" icon="person-add" onPress={onRequest} />
      <Text className="text-center text-sm text-stone-500">
        Il gruppo vedrà il tuo profilo. Potrai partecipare alla chat appena ti accettano.
      </Text>
    </View>
  );
}
