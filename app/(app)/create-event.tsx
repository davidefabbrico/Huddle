// New event form: any member can organize in their groups. Optional ?groupId= preselects the group.
// Date = a chip for each of the next 14 days; time = "HH:MM" text (no extra libraries needed).
// "Si ripete ogni settimana": weekday chips instead of the date (a recurring event, e.g. the gym).
// "Vacanza" (?kind=trip): first and last day on a month calendar, a destination, no time; the group
// then plans it together (things to do/see) and shares the expenses.
// Topics (from the interests list) help "Per te". Optional poster ("locandina"): a PDF or an image.

import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Header } from '../../components/Header';
import { PlaceField, type PlaceValue } from '../../components/PlaceField';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { MonthCalendar } from '../../components/MonthCalendar';
import { isInPast } from '../../lib/eventTiming';
import { dayKey, fromDayKey, interestOptions, isoWeekday, parseTime, tripDatesLabel, weekdayNames } from '../../lib/format';
import { isPdf, pickPoster } from '../../lib/pickers';
import type { EventKind, NewEventInput, PickedFile } from '../../lib/types';

// Today + the next 13 days, as { label, date } with date at local midnight
function nextDays(count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
    const label =
      i === 0 ? 'Oggi' : i === 1 ? 'Domani' : date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
    return { label, date };
  });
}

export default function CreateEventScreen() {
  const params = useLocalSearchParams<{ groupId?: string; kind?: string }>();
  const groupId = params.groupId;
  const [kind, setKind] = useState<EventKind>(params.kind === 'trip' ? 'trip' : 'event');
  const isTrip = kind === 'trip';
  const [tripMonth, setTripMonth] = useState(() => new Date());
  const [tripDays, setTripDays] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const user = useAuth((state) => state.user)!;
  const memberships = useAsync(() => api.getMemberships(user.id), [user.id]);

  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(groupId);
  const [title, setTitle] = useState('');
  const [dayIndex, setDayIndex] = useState(1); // tomorrow
  const [time, setTime] = useState('19:30');
  const [place, setPlace] = useState<PlaceValue>({ text: '', lat: null, lon: null });
  const [poster, setPoster] = useState<PickedFile | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const days = nextDays();

  const groups = memberships.data ?? [];
  const groupIdToUse = selectedGroup ?? (groups.length === 1 ? groups[0].group.id : undefined);

  // Holiday dates: the first tap is the first day, the second the last day (tap again to restart)
  function pickTripDay(day: string) {
    setTripDays(({ start, end }) => (!start || end || day < start ? { start: day, end: null } : { start, end: day }));
  }

  async function handleCreate() {
    setError(undefined);
    if (!groupIdToUse) return setError('Scegli il gruppo');
    if (isTrip) {
      if (!tripDays.start) return setError('Scegli il primo e l’ultimo giorno sul calendario');
      // 9:00 of the first day to 21:00 of the last one (in the calendar, the whole days)
      const start = fromDayKey(tripDays.start);
      start.setHours(9);
      const end = fromDayKey(tripDays.end ?? tripDays.start);
      end.setHours(21);
      return create({ date_time: start.toISOString(), ends_at: end.toISOString(), kind: 'trip' });
    }
    const parsed = parseTime(time);
    if (!parsed) return setError('Scrivi l’orario come 19:30');
    if (repeat && weekdays.length === 0) return setError('Scegli in quali giorni si ripete');
    const start = new Date(days[repeat ? 0 : dayIndex].date);
    start.setHours(Number(parsed.slice(0, 2)), Number(parsed.slice(3)));
    if (!repeat && isInPast(start)) return setError('Scegli un orario nel futuro');

    return create({ date_time: start.toISOString(), repeat_weekdays: repeat ? weekdays : null });
  }

  async function create(when: Pick<NewEventInput, 'date_time' | 'ends_at' | 'kind' | 'repeat_weekdays'>) {
    setLoading(true);
    try {
      const event = await api.createEvent(user.id, {
        group_id: groupIdToUse!,
        title,
        location: place.text,
        lat: place.lat,
        lon: place.lon,
        tags,
        poster,
        ...when,
      });
      router.replace({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creazione non riuscita');
      setLoading(false);
    }
  }

  if (!memberships.data) {
    return (
      <Screen>
        <Header title={isTrip ? 'Nuova vacanza' : 'Nuovo evento'} />
        <ActivityIndicator color={colors.brand} className="mt-10" />
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <Header title={isTrip ? 'Nuova vacanza' : 'Nuovo evento'} />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-center text-stone-600">Per organizzare un evento entra in un gruppo, oppure creane uno tuo.</Text>
          <Button title="Crea un gruppo" icon="people" onPress={() => router.replace('/create-group')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={isTrip ? 'Nuova vacanza' : 'Nuovo evento'} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-5 px-4 py-5" keyboardShouldPersistTaps="handled">
          {groups.length > 1 ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-stone-700">Gruppo</Text>
              <View className="flex-row flex-wrap gap-2">
                {groups.map(({ group }) => (
                  <Chip
                    key={group.id}
                    label={group.name}
                    selected={groupIdToUse === group.id}
                    onPress={() => setSelectedGroup(group.id)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-base text-stone-600">
              Per <Text className="font-semibold text-ink">{groups[0].group.name}</Text>
            </Text>
          )}

          <View className="flex-row flex-wrap gap-2">
            <Chip label="📅 Evento" selected={!isTrip} onPress={() => setKind('event')} />
            <Chip label="🏖️ Vacanza" selected={isTrip} onPress={() => setKind('trip')} />
          </View>

          <TextField
            label="Titolo"
            value={title}
            onChangeText={setTitle}
            placeholder={isTrip ? 'Es. Ponte in Sicilia' : 'Es. Corsa serale 6 km'}
          />

          {isTrip ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-stone-700">
                {tripDays.start
                  ? `🏖️ ${tripDatesLabel(fromDayKey(tripDays.start).toISOString(), fromDayKey(tripDays.end ?? tripDays.start).toISOString())}${tripDays.end ? '' : ' · ora tocca l’ultimo giorno'}`
                  : 'Tocca il primo e l’ultimo giorno'}
              </Text>
              <MonthCalendar
                month={tripMonth}
                onMonthChange={setTripMonth}
                range={tripDays}
                minDay={dayKey(new Date())}
                onDayPress={pickTripDay}
              />
            </View>
          ) : (
            <View className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-sm font-medium text-stone-700">{repeat ? 'Ogni settimana, di' : 'Giorno'}</Text>
                <Chip
                  label="🔁 Si ripete ogni settimana"
                  selected={repeat}
                  onPress={() => {
                    // start from the weekday of the chosen day
                    if (!repeat && weekdays.length === 0) setWeekdays([isoWeekday(days[dayIndex].date)]);
                    setRepeat(!repeat);
                  }}
                />
              </View>
              {repeat ? (
                <View className="flex-row flex-wrap gap-2">
                  {weekdayNames.map((name, index) => {
                    const day = index + 1;
                    const selected = weekdays.includes(day);
                    return (
                      <Chip
                        key={name}
                        label={name}
                        selected={selected}
                        onPress={() => setWeekdays(selected ? weekdays.filter((d) => d !== day) : [...weekdays, day])}
                      />
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  {days.map((day, index) => (
                    <Chip key={day.label} label={day.label} selected={dayIndex === index} onPress={() => setDayIndex(index)} />
                  ))}
                </ScrollView>
              )}
              {repeat ? (
                <Text className="text-xs text-stone-500">
                  Le date vengono create due settimane in anticipo. Chi dice “Ci sono ogni volta” risulta già presente, con la sua auto.
                </Text>
              ) : null}
            </View>

          )}

          {isTrip ? null : (
            <TextField label="Ora" value={time} onChangeText={setTime} placeholder="19:30" keyboardType="numbers-and-punctuation" />
          )}
          <PlaceField
            label={isTrip ? 'Destinazione' : 'Luogo'}
            value={place}
            onChange={setPlace}
            placeholder={isTrip ? 'Es. Palermo' : 'Es. Via Pascal 12, Milano'}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-stone-700">Di cosa si tratta? (fino a 3)</Text>
            <View className="flex-row flex-wrap gap-2">
              {interestOptions.map((interest) => {
                const selected = tags.includes(interest);
                return (
                  <Chip
                    key={interest}
                    label={interest}
                    selected={selected}
                    onPress={() =>
                      setTags(selected ? tags.filter((t) => t !== interest) : tags.length < 3 ? [...tags, interest] : tags)
                    }
                  />
                );
              })}
            </View>
            <Text className="text-xs text-stone-500">Così “Per te” lo suggerisce a chi ha questi interessi.</Text>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-stone-700">Locandina (facoltativa)</Text>
            {poster ? (
              <View className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <Ionicons name={isPdf(poster.mimeType) ? 'document-text' : 'image-outline'} size={22} color={colors.brandDark} />
                <Text numberOfLines={1} className="flex-1 text-ink">
                  {poster.name}
                </Text>
                <Button title="Rimuovi" size="sm" variant="muted" onPress={() => setPoster(null)} />
              </View>
            ) : (
              <Button
                title="Aggiungi PDF o immagine"
                icon="attach"
                variant="secondary"
                onPress={async () => {
                  try {
                    setPoster(await pickPoster());
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'File non valido');
                  }
                }}
              />
            )}
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          <Button
            title={isTrip ? 'Crea vacanza' : repeat ? 'Crea evento ricorrente' : 'Crea evento'}
            icon={isTrip ? 'airplane' : repeat ? 'repeat' : 'calendar'}
            onPress={handleCreate}
            loading={loading}
          />
          <Text className="text-center text-sm text-stone-500">
            {isTrip
              ? 'I membri del gruppo riceveranno una notifica e potranno preparare insieme cosa fare e cosa vedere.'
              : 'I membri del gruppo riceveranno una notifica.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
