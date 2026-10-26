// Event detail: info, RSVP ("Ci sarò"), check-in ("Sono qui") while it's live, and who's coming.
// Checking in is what makes you climb the ranks of the group.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Avatar } from '../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { GroupIcon } from '../../../components/GroupIcon';
import { Header } from '../../../components/Header';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { eventPhase } from '../../../lib/eventTiming';
import { formatEventDate } from '../../../lib/format';
import type { Rank } from '../../../lib/ranks';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user)!;
  const [version, setVersion] = useState(0); // bump to refetch after an action
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [newRank, setNewRank] = useState<Rank | null>(null);

  const data = useAsync(async () => {
    const event = await api.getEventById(id);
    if (!event) return null;
    const [access, attendance, attendees] = await Promise.all([
      api.canAccessChat(user.id, event.group_id),
      api.getAttendance(user.id, id),
      api.getEventAttendees(id),
    ]);
    return { event, access, attendance, attendees };
  }, [id, user.id, version]);

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Qualcosa è andato storto');
    } finally {
      setBusy(false);
    }
  }

  if (data.data === undefined || data.data === null) {
    return (
      <Screen>
        <Header title="Evento" />
        {data.data === null ? (
          <Text className="p-4 text-stone-600">Questo evento non esiste.</Text>
        ) : (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        )}
      </Screen>
    );
  }

  const { event, access, attendance, attendees } = data.data;
  const phase = eventPhase(event.date_time);
  const checkedInCount = attendees.filter((a) => a.checked_in).length;

  return (
    <Screen>
      <Header title={event.title} subtitle={event.group_name} />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-5">
        <View className="gap-3 rounded-3xl border border-stone-200 bg-white p-4">
          {phase === 'live' ? <Badge label="In corso" tone="green" icon="radio-button-on" /> : null}
          {phase === 'ended' ? <Badge label="Concluso" icon="checkmark-done" /> : null}
          <Text className="text-2xl font-bold text-ink">{event.title}</Text>
          <InfoRow icon="time-outline" text={formatEventDate(event.date_time)} />
          <InfoRow icon="location-outline" text={event.location} />
          <Link href={{ pathname: '/group/[id]', params: { id: event.group_id } }} asChild>
            <Pressable className="mt-1 flex-row items-center gap-3 rounded-2xl bg-stone-50 p-3 active:bg-stone-100">
              <GroupIcon name={event.group_name} size={36} />
              <Text className="flex-1 font-semibold text-ink">{event.group_name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </View>

        {newRank ? (
          <View className="items-center gap-1 rounded-3xl bg-amber-100 p-5">
            <Text className="text-4xl">{newRank.emoji}</Text>
            <Text className="text-center text-lg font-bold text-amber-900">Nuovo grado: {newRank.name}!</Text>
            <Text className="text-center text-sm text-amber-800">{newRank.description}</Text>
          </View>
        ) : null}

        {/* Call to action, depending on access and timing */}
        {!access ? (
          <View className="gap-2">
            <Button
              title="Entra nel gruppo per partecipare"
              icon="person-add"
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: event.group_id } })}
            />
            <Text className="text-center text-sm text-stone-500">Anche da ospite puoi venire agli eventi.</Text>
          </View>
        ) : phase === 'ended' ? (
          <Button
            title={attendance?.checked_in ? 'C’eri anche tu ✓' : 'Evento concluso'}
            variant="muted"
            disabled
          />
        ) : phase === 'live' ? (
          attendance?.checked_in ? (
            <Button title="Check-in fatto ✓" icon="checkmark-circle" variant="secondary" disabled />
          ) : (
            <View className="gap-2">
              <Button
                title="Sono qui! Fai check-in"
                icon="location"
                loading={busy}
                onPress={() =>
                  run(async () => {
                    const result = await api.checkIn(user.id, event.id);
                    setNewRank(result.newRank);
                  })
                }
              />
              <Text className="text-center text-sm text-stone-500">Ogni check-in ti fa salire di grado nel gruppo.</Text>
            </View>
          )
        ) : attendance ? (
          <View className="gap-2">
            <Button title="Ci sarai! ✓" icon="checkmark-circle" variant="secondary" disabled />
            <Button
              title="Non posso più venire"
              variant="muted"
              size="sm"
              loading={busy}
              onPress={() => run(() => api.setAttending(user.id, event.id, false))}
            />
          </View>
        ) : (
          <Button
            title="Ci sarò"
            icon="hand-right"
            loading={busy}
            onPress={() => run(() => api.setAttending(user.id, event.id, true))}
          />
        )}
        {error ? <Text className="text-center text-sm text-red-600">{error}</Text> : null}

        {/* Who's coming (visible to members and guests, like in the database rules) */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">
            Chi viene{access ? ` (${attendees.length})` : ''}
          </Text>
          {!access ? (
            <Text className="text-stone-500">Entra nel gruppo per vedere chi partecipa.</Text>
          ) : attendees.length === 0 ? (
            <Text className="text-stone-500">Ancora nessuno: rompi il ghiaccio!</Text>
          ) : (
            <>
              {checkedInCount > 0 ? (
                <Text className="text-sm text-stone-500">{checkedInCount} già sul posto</Text>
              ) : null}
              <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
                {attendees.map((person, index) => (
                  <View
                    key={person.id}
                    className={`flex-row items-center gap-3 p-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}
                  >
                    <Avatar name={person.full_name} size={36} />
                    <View className="flex-1 flex-row flex-wrap items-center gap-2">
                      <Text className="font-medium text-ink">
                        {person.full_name}
                        {person.id === user.id ? ' (tu)' : ''}
                      </Text>
                      {person.is_relocated ? <RelocatedBadge /> : null}
                    </View>
                    {person.checked_in ? (
                      <Badge label="Qui" tone="green" icon="location" />
                    ) : (
                      <Text className="text-xs text-stone-400">ci sarà</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon, text }: { icon: 'time-outline' | 'location-outline'; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text className="flex-1 text-base text-stone-700">{text}</Text>
    </View>
  );
}
