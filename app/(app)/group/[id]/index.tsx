// Group detail: description, join button, upcoming events, members.
// Join flow: "Chiedi di unirti" -> "In attesa…" -> the admin accepts (you get a notification).
// Members and guests see the button to the external chat (WhatsApp, Telegram…) if the admin set one,
// and the group's points leaderboard. Members can organize events and invite friends.
// The admin also sees "Gestisci il gruppo": edit and pending requests.
// "La nostra storia" opens the group's timeline (group/[id]/history).
// On a computer: the group, its actions and events on the left; leaderboard and members on the right.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, avatarOf } from '../../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { GroupMascotCard } from '../../../../components/GroupMascotCard';
import { GroupTheme, useBrand } from '../../../../components/GroupTheme';
import { ReliabilityBadge } from '../../../../components/ReliabilityBadge';
import { Columns } from '../../../../components/Columns';
import { ConfirmButton } from '../../../../components/ConfirmButton';
import { EventCard } from '../../../../components/EventCard';
import { ExternalChatButton } from '../../../../components/ExternalChatButton';
import { InviteButton } from '../../../../components/InviteButton';
import { GroupIcon, groupIconOf } from '../../../../components/GroupIcon';
import { Header } from '../../../../components/Header';
import { Screen } from '../../../../components/Screen';
import { colors } from '../../../../components/theme';
import { useAsync } from '../../../../hooks/useAsync';
import { useAuth } from '../../../../hooks/useAuth';
import { hasChatAccess, useJoinStore, type GroupAccess } from '../../../../hooks/useJoinStore';
import * as api from '../../../../lib/api';
import { ageRangeLabel } from '../../../../lib/search';
import { parkingGroupUrl } from '../../../../lib/smartpark';
import type { Group, JoinStatus, LeaderboardEntry } from '../../../../lib/types';
import { Text } from '../../../../components/Text';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user)!;
  const access = useJoinStore((state) => state.access[id] ?? 'loading');
  const loadAccess = useJoinStore((state) => state.load);

  const details = useAsync(
    async () => {
      const withAccess = hasChatAccess(access);
      const [group, members, events, links, answers, leaderboard, level] = await Promise.all([
        api.getGroupById(id),
        api.getGroupMembers(id),
        api.getGroupEvents(id),
        api.getGroupLinks(id),
        api.getMyAnswers(user.id),
        withAccess ? api.getGroupLeaderboard(id) : Promise.resolve([]),
        api.getGroupLevel(id),
      ]);
      const reliability = await api.getReliability(members.map((m) => m.id), [id]);
      return { group, members, events, links, answers, leaderboard, reliability, level };
    },
    [id, user.id, access], // refetch after joining so the member list updates
    { refetchOnFocus: true }, // and after editing the group
  );

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

  const { members, events, links, answers, leaderboard, reliability, level } = details.data;
  const ages = ageRangeLabel(group.age_min, group.age_max);
  const isMember = access === 'member';

  return (
    <GroupTheme group={group}>
      <Screen width="wide">
        <Header title={group.name} subtitle={members.length === 1 ? '1 membro' : `${members.length} membri`} />
        <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-2 wide:px-8 wide:pt-6">
          <Columns
            main={
              <>
                <View className="flex-row items-center gap-4">
                  <GroupIcon {...groupIconOf(group)} size={64} />
                  <View className="flex-1 gap-1.5">
                    {group.location ? (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="location-outline" size={14} className="text-stone-500" />
                        <Text className="text-sm text-stone-500">{group.location}</Text>
                      </View>
                    ) : null}
                    <View className="flex-row flex-wrap gap-1.5">
                      {group.type === 'open_to_new' ? (
                        <Badge label="Aperto" tone="green" icon="checkmark-circle" />
                      ) : (
                        <Badge label="Al completo" icon="lock-closed" />
                      )}
                      {group.visibility === 'private' ? <Badge label="Privato" icon="lock-closed" tone="brand" /> : null}
                      {group.is_business ? <Badge label="Locale" icon="storefront" tone="sky" /> : null}
                      {ages ? <Badge label={ages} icon="person" /> : null}
                      <ReliabilityBadge points={reliability.groups[group.id]} />
                    </View>
                  </View>
                </View>

                {group.description ? <Text className="text-base leading-6 text-stone-700">{group.description}</Text> : null}

                <GroupMascotCard group={group} level={level} care={{ groupId: id, canCare: isMember }} />

                <JoinSection group={group} access={access} onRequest={() => useJoinStore.getState().requestToJoin(user.id, id)} />

                {links.chat_url && hasChatAccess(access) ? <ExternalChatButton url={links.chat_url} /> : null}
                {links.parking_code && hasChatAccess(access) ? <ParkingGroupButton code={links.parking_code} /> : null}

                <View className="flex-row flex-wrap gap-2">
                  {isMember ? (
                    <>
                      <Button
                        title="Organizza"
                        icon="calendar"
                        size="sm"
                        variant="secondary"
                        onPress={() => router.push({ pathname: '/create-event', params: { groupId: group.id } })}
                      />
                      <InviteButton group={group} />
                    </>
                  ) : null}
                  <Button
                    title="Storia"
                    icon="time-outline"
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/group/[id]/history', params: { id: group.id } })}
                  />
                </View>

                {group.admin_id === user.id ? <AdminSection group={group} onChanged={details.reload} /> : null}

                <View className="gap-3">
                  <Text className="text-lg font-semibold text-ink">Prossimi eventi</Text>
                  {events.length === 0 ? (
                    <Text className="text-stone-500">
                      Nessun evento in programma.{isMember ? ' Organizzane uno: i membri riceveranno una notifica.' : ''}
                    </Text>
                  ) : (
                    events.map((event) => <EventCard key={event.id} event={event} answer={answers[event.id]} />)
                  )}
                </View>
              </>
            }
            side={
              <>
                {leaderboard.length > 0 ? <Leaderboard entries={leaderboard} myId={user.id} /> : null}

                <View className="gap-3">
                  <Text className="text-lg font-semibold text-ink">Membri ({members.length})</Text>
                  <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
                    {members.map((member, index) => (
                      <View
                        key={member.id}
                        className={`flex-row gap-3 p-4 ${index > 0 ? 'border-t border-stone-100' : ''}`}
                      >
                        <Avatar {...avatarOf(member)} />
                        <View className="flex-1 gap-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="font-semibold text-ink">
                              {member.full_name}
                              {member.id === user.id ? ' (tu)' : ''}
                            </Text>
                            {member.member_role === 'admin' ? <Badge label="Admin" tone="brand" icon="star" /> : null}
                            {member.is_relocated ? <RelocatedBadge /> : null}
                            <ReliabilityBadge points={reliability.users[member.id]} />
                          </View>
                          <Text numberOfLines={2} className="text-sm text-stone-500">
                            {member.bio}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {isMember && group.admin_id !== user.id ? (
                  <ConfirmButton
                    title="Esci dal gruppo"
                    confirmTitle="Sì, esci"
                    icon="exit-outline"
                    warning={
                      group.visibility === 'private'
                        ? 'Non vedrai più il gruppo, i suoi eventi e la chat. Per rientrare servirà un nuovo invito.'
                        : 'Non vedrai più la chat e gli eventi dei membri. Potrai chiedere di rientrare.'
                    }
                    onConfirm={async () => {
                      await api.leaveGroup(user.id, group.id);
                      useJoinStore.getState().reset();
                      router.replace('/');
                    }}
                  />
                ) : null}
              </>
            }
          />
        </ScrollView>
      </Screen>
    </GroupTheme>
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
          Abbiamo avvisato l’admin: riceverai una notifica quando risponde.
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

// Admin tools: edit, invite link (private groups), requests, delete
function AdminSection({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const brand = useBrand();
  const groupId = group.id;
  const [newLink, setNewLink] = useState(false);
  const requests = useAsync(() => api.getGroupJoinRequests(groupId), [groupId]);
  const [busyId, setBusyId] = useState<string>();

  async function decide(requestId: string, status: JoinStatus) {
    setBusyId(requestId);
    try {
      await api.updateJoinRequestStatus(requestId, status);
      requests.reload();
      onChanged(); // the member list may have changed
    } finally {
      setBusyId(undefined);
    }
  }

  const list = requests.data ?? [];

  return (
    <View className="gap-3 rounded-3xl bg-brand-50 p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="star" size={16} color={brand[600]} />
        <Text className="text-base font-semibold text-brand-700">Gestisci il gruppo</Text>
      </View>

      <Button
        title="Modifica il gruppo"
        icon="create-outline"
        variant="secondary"
        onPress={() => router.push({ pathname: '/edit-group', params: { id: groupId } })}
      />

      <Text className="mt-1 text-sm font-semibold text-stone-600">
        Richieste e ospiti{list.length ? ` (${list.length})` : ''}
      </Text>
      {!requests.data ? (
        <ActivityIndicator color={colors.brand} />
      ) : list.length === 0 ? (
        <Text className="text-sm text-stone-500">Nessuna richiesta in attesa.</Text>
      ) : (
        list.map((request) => (
          <View key={request.id} className="gap-3 rounded-2xl bg-white p-3">
            <View className="flex-row gap-3">
              <Avatar {...avatarOf(request.user)} size={40} />
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-semibold text-ink">{request.user.full_name}</Text>
                  {request.status === 'guest' ? <Badge label="Ospite" tone="sky" /> : null}
                  {request.user.is_relocated ? <RelocatedBadge /> : null}
                </View>
                <Text numberOfLines={2} className="text-sm text-stone-500">
                  {request.user.bio}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                title="Accetta"
                icon="checkmark"
                size="sm"
                loading={busyId === request.id}
                onPress={() => decide(request.id, 'accepted')}
              />
              {request.status === 'pending' ? (
                <Button
                  title="Solo ospite"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === request.id}
                  onPress={() => decide(request.id, 'guest')}
                />
              ) : null}
              <Button
                title="Rifiuta"
                size="sm"
                variant="muted"
                disabled={busyId === request.id}
                onPress={() => decide(request.id, 'rejected')}
              />
            </View>
          </View>
        ))
      )}

      {group.visibility === 'private' ? (
        <View className="mt-1 gap-2">
          <Text className="text-sm font-semibold text-stone-600">Link d’invito</Text>
          <Text className="text-sm text-stone-500">
            Il gruppo è privato: si entra solo con il link (usa “Invita amici”). Se è finito in mani sbagliate, creane uno nuovo:
            quello vecchio smette di funzionare.
          </Text>
          <Button
            title={newLink ? 'Nuovo link creato ✓' : 'Crea un nuovo link'}
            icon="refresh"
            size="sm"
            variant="secondary"
            disabled={newLink}
            onPress={async () => {
              await api.regenerateInviteCode(groupId);
              setNewLink(true);
              onChanged();
            }}
          />
        </View>
      ) : null}

      <View className="mt-2">
        <ConfirmButton
          title="Elimina il gruppo"
          confirmTitle="Sì, elimina"
          icon="trash-outline"
          warning={`Vuoi eliminare «${group.name}»? Spariscono per tutti i membri eventi, chat, grazie e classifica. Non si può annullare.`}
          onConfirm={async () => {
            await api.deleteGroup(groupId);
            useJoinStore.getState().reset();
            router.replace('/');
          }}
        />
      </View>
    </View>
  );
}

// Points earned in this group: organizing, attending, thanks received (lib/points.ts)
function Leaderboard({ entries, myId }: { entries: LeaderboardEntry[]; myId: string }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-ink">Classifica del gruppo</Text>
      <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
        {entries.map((entry, index) => (
          <View
            key={entry.user.id}
            className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-stone-100' : ''} ${entry.user.id === myId ? 'bg-brand-50' : ''}`}
          >
            <Text className="w-7 text-center text-base font-semibold text-stone-500">
              {entry.points > 0 && index < 3 ? medals[index] : index + 1}
            </Text>
            <Avatar {...avatarOf(entry.user)} size={34} />
            <View className="flex-1">
              <Text numberOfLines={1} className="font-semibold text-ink">
                {entry.user.full_name}
                {entry.user.id === myId ? ' (tu)' : ''}
              </Text>
              <Text className="text-xs text-stone-500">
                {entry.attended} eventi · {entry.organized} organizzati · {entry.thanks_received} 🙏
                {entry.passengers ? ` · ${entry.passengers} 🚗` : ''}
              </Text>
            </View>
            <Text className="text-base font-bold text-brand-600">{entry.points} pt</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// The friends' parking group on SmartPark: shared parking spots, and not everyone heading to the same place
function ParkingGroupButton({ code }: { code: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(parkingGroupUrl(code))}
      accessibilityRole="link"
      className="flex-row items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 active:bg-sky-100"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
        <Text className="text-lg font-extrabold text-[#FFFFFF]">P</Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-ink">Parcheggi del gruppo su SmartPark</Text>
        <Text className="text-xs text-stone-500">Codice {code} · scoprite insieme dove si trova posto</Text>
      </View>
      <Ionicons name="open-outline" size={18} className="text-stone-500" />
    </Pressable>
  );
}
