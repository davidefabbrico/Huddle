// Recurring event (on each occurrence): when it repeats, who's there every time, and
// "Ci sono ogni volta": your choices here (car, seats, departure, the driver who accepted you)
// are copied to the next occurrences, so the cars for the gym get organized once.

import { Text, View } from 'react-native';
import { firstName, shortTime, weekdaysLabel } from '../lib/format';
import type { EventWithGroup, SeriesRegular, User } from '../lib/types';
import { Button } from './Button';
import { ConfirmButton } from './ConfirmButton';

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
}

const transportLabels = { car: '🚗 in auto', need_ride: '🙋 cerchi un passaggio', own: '🚶 per conto tuo' };

export function SeriesCard({ series, regulars, people, myId, canAnswer, canStop, busy, onSetRegular, onRemoveRegular, onStop }: Props) {
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
    <View className="gap-3 rounded-3xl border border-violet-200 bg-violet-50 p-4">
      <Text className="text-base font-semibold text-violet-950">
        🔁 Si ripete {weekdaysLabel(series.weekdays)} alle {shortTime(series.start_time)}
      </Text>
      {others.length > 0 ? (
        <Text className="text-sm text-violet-900">Ci sono ogni volta: {others.map((r) => nameOf(r.user_id)).join(', ')}</Text>
      ) : null}

      {canAnswer ? (
        mine ? (
          <View className="gap-2">
            <Text className="text-sm text-violet-900">
              <Text className="font-semibold">Ci sei ogni volta</Text>
              {usual ? ` · ${usual}` : ''}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button title="Usa le scelte di oggi" icon="repeat" size="sm" variant="secondary" disabled={busy} onPress={onSetRegular} />
              <Button title="Non più ogni volta" size="sm" variant="muted" disabled={busy} onPress={onRemoveRegular} />
            </View>
            <Text className="text-xs text-violet-800">
              Le prossime volte risulti già tra chi c’è, con le stesse scelte per l’auto. Per una data sola rispondi “Non ci sono”.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            <Button title="Ci sono ogni volta" icon="repeat" variant="secondary" disabled={busy} onPress={onSetRegular} />
            <Text className="text-xs text-violet-800">
              Copia le tue scelte di oggi (auto, posti, partenza, passaggio) sulle prossime date.
            </Text>
          </View>
        )
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
