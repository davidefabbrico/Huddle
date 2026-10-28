// "Ci vado": the events and holidays you said "Ci sono" to, as a month calendar (a dot on each day)
// and a list: the next ones, or the chosen day's. Calendar and list side by side on a computer.

import { useState } from 'react';
import { View } from 'react-native';
import { useIsWide } from '../hooks/useLayout';
import { CHECKIN_CLOSES_AFTER_MS } from '../lib/eventTiming';
import { dayKeysBetween, shortDayLabel } from '../lib/format';
import type { EventWithGroup } from '../lib/types';
import { Button } from './Button';
import { EventCard } from './EventCard';
import { MonthCalendar } from './MonthCalendar';
import { Text } from './Text';

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function AgendaView({ events }: { events: EventWithGroup[] }) {
  const wide = useIsWide();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now()); // "next" = from when the screen was opened

  const daysOf = new Map(events.map((e) => [e.id, dayKeysBetween(e.date_time, e.ends_at)]));
  const marks: Record<string, number> = {};
  for (const days of daysOf.values()) for (const day of days) marks[day] = (marks[day] ?? 0) + 1;

  const since = openedAt - CHECKIN_CLOSES_AFTER_MS;
  const shown = selected
    ? events.filter((e) => daysOf.get(e.id)!.includes(selected))
    : events.filter((e) => new Date(e.ends_at ?? e.date_time).getTime() >= since);

  const list = (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-lg font-semibold text-ink">{selected ? capitalized(shortDayLabel(selected)) : 'I prossimi'}</Text>
        {selected ? <Button title="Tutti i prossimi" size="sm" variant="muted" onPress={() => setSelected(null)} /> : null}
      </View>
      {shown.length === 0 ? (
        <Text className="text-stone-500">
          {selected
            ? 'Niente in programma questo giorno.'
            : 'Non hai ancora detto “Ci sono” a nessun evento in programma. Guarda “Per te” o “Tutti”.'}
        </Text>
      ) : (
        shown.map((event) => <EventCard key={event.id} event={event} showGroup />)
      )}
    </View>
  );

  const calendar = (
    <MonthCalendar
      month={month}
      onMonthChange={setMonth}
      marks={marks}
      selected={selected}
      onDayPress={(day) => setSelected(day === selected ? null : day)}
    />
  );

  return wide ? (
    <View className="flex-row items-start gap-8">
      <View className="w-96">{calendar}</View>
      <View className="flex-1">{list}</View>
    </View>
  ) : (
    <View className="gap-5">
      {calendar}
      {list}
    </View>
  );
}
