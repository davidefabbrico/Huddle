// Eventi tab: upcoming events grouped by day, all or only from your groups

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
import type { EventWithGroup } from '../../../lib/types';

type Filter = 'all' | 'mine';

export default function EventsScreen() {
  const user = useAuth((state) => state.user)!;
  const [filter, setFilter] = useState<Filter>('all');

  const data = useAsync(
    async () => {
      const [events, memberships] = await Promise.all([api.getUpcomingEvents(50), api.getMemberships(user.id)]);
      return { events, myGroupIds: new Set(memberships.map((m) => m.group.id)) };
    },
    [user.id],
    { refetchOnFocus: true },
  );

  const events = (data.data?.events ?? []).filter((e) => filter === 'all' || data.data?.myGroupIds.has(e.group_id));

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
          <Text className="text-base text-stone-600">Il modo più facile per conoscere un gruppo è andare a un evento.</Text>
        </View>

        <View className="flex-row gap-2">
          <Chip label="Tutti" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Dei miei gruppi" selected={filter === 'mine'} onPress={() => setFilter('mine')} />
        </View>

        {!data.data && data.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : data.error ? (
          <Text className="text-red-600">{data.error}</Text>
        ) : days.length === 0 ? (
          <Text className="mt-6 text-center text-stone-500">
            {filter === 'mine' ? 'Nessun evento in programma nei tuoi gruppi.' : 'Nessun evento in programma.'}
          </Text>
        ) : (
          days.map((day) => (
            <View key={day.label} className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-wide text-stone-500">{day.label}</Text>
              {day.events.map((event) => (
                <EventCard key={event.id} event={event} showGroup />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
