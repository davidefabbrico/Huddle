// Eventi tab: "Per te" (suggestions with the reason, lib/recommendations.ts), or upcoming events
// grouped by day, all or only from your groups

import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Chip } from '../../../components/Chip';
import { EventCard } from '../../../components/EventCard';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { dayLabel } from '../../../lib/format';
import { recommendEvents } from '../../../lib/recommendations';
import type { EventWithGroup } from '../../../lib/types';

type Filter = 'forYou' | 'all' | 'mine';

export default function EventsScreen() {
  const user = useAuth((state) => state.user)!;
  const [filter, setFilter] = useState<Filter>('forYou');

  const data = useAsync(
    async () => {
      const [events, memberships, answers, signals] = await Promise.all([
        api.getUpcomingEvents(100),
        api.getMemberships(user.id),
        api.getMyAnswers(user.id),
        api.getForYouSignals(),
      ]);
      const myGroupIds = new Set(memberships.map((m) => m.group.id));
      return { events, answers, myGroupIds, suggestions: recommendEvents(events, user, answers, myGroupIds, signals) };
    },
    [user.id],
    { refetchOnFocus: true },
  );

  const events = (data.data?.events ?? []).filter((e) => filter === 'all' || data.data?.myGroupIds.has(e.group_id));
  const suggestions = data.data?.suggestions ?? [];

  // Events are already sorted by date: split them into consecutive days
  const days: { label: string; events: EventWithGroup[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.date_time);
    if (days.at(-1)?.label === label) days.at(-1)!.events.push(event);
    else days.push({ label, events: [event] });
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-4">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-ink">Eventi</Text>
          <Text className="text-base text-stone-600">Rispondi “Ci sono” o “Non ci sono”: così chi organizza sa su chi contare.</Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Chip label="✨ Per te" selected={filter === 'forYou'} onPress={() => setFilter('forYou')} />
          <Chip label="Tutti" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Dei miei gruppi" selected={filter === 'mine'} onPress={() => setFilter('mine')} />
        </View>

        {!data.data && data.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : data.error ? (
          <Text className="text-red-600">{data.error}</Text>
        ) : filter === 'forYou' ? (
          suggestions.length === 0 ? (
            <Text className="mt-6 text-center text-stone-500">
              Nessun suggerimento: hai già risposto a tutti gli eventi in programma. Aggiungi interessi al profilo per scoprirne altri.
            </Text>
          ) : (
            <View className="gap-3">
              <Text className="text-sm text-stone-500">
                In base ai tuoi interessi e a cosa piace a chi è nei tuoi gruppi. Ci sono solo eventi a cui non hai ancora risposto.
              </Text>
              {suggestions.map((s) => (
                <EventCard key={s.event.id} event={s.event} showGroup reason={s.reason} outside={s.outside} />
              ))}
            </View>
          )
        ) : days.length === 0 ? (
          <Text className="mt-6 text-center text-stone-500">
            {filter === 'mine' ? 'Nessun evento in programma nei tuoi gruppi.' : 'Nessun evento in programma.'}
          </Text>
        ) : (
          days.map((day) => (
            <View key={day.label} className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-wide text-stone-500">{day.label}</Text>
              {day.events.map((event) => (
                <EventCard key={event.id} event={event} showGroup answer={data.data?.answers[event.id]} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
