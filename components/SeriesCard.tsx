// Recurring event (on each occurrence): when it repeats, who's there every time, and
// "Ci sono ogni volta": your choices here (car, seats, departure, the driver who accepted you)
// are copied to the next occurrences, so the cars for the gym get organized once.
// The creator or the admin can move the last day ("Allunga o accorcia") or stop it.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { dayKey, firstName, fromDayKey, shortDayLabel, shortTime, weekdaysLabel } from '../lib/format';
import type { EventWithGroup, SeriesRegular, User } from '../lib/types';
import { Button } from './Button';
import { ConfirmButton } from './ConfirmButton';
import { MonthCalendar } from './MonthCalendar';
import { InfoTip } from './InfoTip';

interface Props {
  series: NonNullable<EventWithGroup['series']>;
  regulars: SeriesRegular[];
  people: Pick<User, 'id' | 'full_name'>[]; // to name the regulars (members and attendees)
  myId: string;
  canAnswer: boolean; // has access and the event hasn't ended
  canStop: boolean; // series creator or group admin
  busy: boolean;
  onSetRegular: () => void;
  onRemoveRegular: () => void;
  onStop: () => Promise<void>;
  onSetEnd: (lastDay: string) => void;
}

const transportLabels = { car: '🚗 in auto', need_ride: '🙋 cerchi un passaggio', own: '🚶 per conto tuo' };

export function SeriesCard({ series, regulars, people, myId, canAnswer, canStop, busy, onSetRegular, onRemoveRegular, onStop, onSetEnd }: Props) {
  const [editingEnd, setEditingEnd] = useState(false);
  const [newEnd, setNewEnd] = useState(series.ends_on ?? dayKey(new Date()));
  const [month, setMonth] = useState(() => fromDayKey(series.ends_on ?? dayKey(new Date())));
  // at most a year from the first day
  const maxEnd = series.starts_on ? dayKey(new Date(fromDayKey(series.starts_on).getTime() + 366 * 86400e3)) : null;
  const nameOf = (id: string) => {
    const person = people.find((p) => p.id === id);
    return id === myId ? 'tu' : person ? firstName(person.full_name) : 'qualcuno';
  };
  const mine = regulars.find((r) => r.user_id === myId);
  const others = regulars.filter((r) => r.user_id !== myId);

  // "🚗 in auto, 3 posti, da Piazza Dante alle 18:30" / "🙋 con Marco"
  const usual = mine
    ? [
        mine.transport ? transportLabels[mine.transport] : null,
        mine.transport === 'car' ? `${mine.seats} ${mine.seats === 1 ? 'posto' : 'posti'}` : null,
        [mine.depart_area ? `da ${mine.depart_area}` : '', mine.depart_time ? `alle ${shortTime(mine.depart_time)}` : '']
          .filter(Boolean)
          .join(' '),
        mine.ride_with ? `con ${nameOf(mine.ride_with)}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <View className="gap-3 rounded-3xl border-2 border-b-4 border-line bg-brand-50 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-pixel text-brand-800">
          🔁 {weekdaysLabel(series.weekdays)} alle {shortTime(series.start_time)}
        </Text>
        <InfoTip text="“Ci sono ogni volta” copia le tue scelte di oggi (auto, posti, partenza, passaggio) sulle prossime date. Per saltare una data rispondi “Non ci sono” solo lì." />
      </View>
      {series.ends_on ? (
        <Text className="-mt-2 text-sm text-brand-700">
          {series.starts_on ? `Dal ${shortDayLabel(series.starts_on)} ` : 'Fino '}al {shortDayLabel(series.ends_on)}
        </Text>
      ) : null}
      {others.length > 0 ? (
        <Text className="text-sm text-brand-700">Ci sono ogni volta: {others.map((r) => nameOf(r.user_id)).join(', ')}</Text>
      ) : null}

      {canAnswer ? (
        mine ? (
          <View className="gap-2">
            <Text className="text-sm text-brand-700">
              <Text className="font-pixel">Ci sei ogni volta</Text>
              {usual ? ` · ${usual}` : ''}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button title="Usa le scelte di oggi" icon="repeat" size="sm" variant="secondary" disabled={busy} onPress={onSetRegular} />
              <Button title="Non più ogni volta" size="sm" variant="muted" disabled={busy} onPress={onRemoveRegular} />
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Button title="Ci sono ogni volta" icon="repeat" variant="secondary" disabled={busy} onPress={onSetRegular} />
          </View>
        )
      ) : null}

      {canStop && editingEnd ? (
        <View className="gap-2">
          <Text className="text-sm font-pixel text-brand-800">Nuovo ultimo giorno: {shortDayLabel(newEnd)}</Text>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={newEnd}
            minDay={dayKey(new Date())}
            onDayPress={(d) => (!maxEnd || d <= maxEnd ? setNewEnd(d) : undefined)}
          />
          <View className="flex-row gap-2">
            <Button
              title="Salva"
              icon="checkmark"
              size="sm"
              disabled={busy}
              onPress={() => {
                onSetEnd(newEnd);
                setEditingEnd(false);
              }}
            />
            <Button title="Annulla" size="sm" variant="muted" onPress={() => setEditingEnd(false)} />
          </View>
        </View>
      ) : canStop ? (
        <Button title="Allunga o accorcia" icon="calendar-outline" size="sm" variant="secondary" onPress={() => setEditingEnd(true)} />
      ) : null}

      {canStop ? (
        <ConfirmButton
          title="Ferma la ricorrenza"
          confirmTitle="Sì, fermala"
          icon="stop-circle-outline"
          warning="Le prossime date vengono cancellate per tutti; quelle passate restano, con i loro punti."
          onConfirm={onStop}
        />
      ) : null}
    </View>
  );
}
