// Edit an event or holiday (?id=event_id): organizer or group admin. Title, day and time (holiday:
// first and last day), place, topics, who sees it. Who's going gets a notification if date or place
// change. For a date of a recurring event the change applies to that date only.
// Cancelling is on the event page ("Annulla l'evento").

import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Header } from '../../components/Header';
import { MonthCalendar } from '../../components/MonthCalendar';
import { PlaceField, type PlaceValue } from '../../components/PlaceField';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import { VisibilityChoice } from '../../components/VisibilityChoice';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { dayKey, fromDayKey, interestOptions, parseTime, tripDatesLabel } from '../../lib/format';
import type { EventVisibility, EventWithGroup, Group } from '../../lib/types';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user)!;
  const data = useAsync(async () => {
    const event = await api.getEventById(id);
    return event ? { event, group: await api.getGroupById(event.group_id) } : null;
  }, [id]);

  const event = data.data?.event;
  const group = data.data?.group;
  const canEdit = Boolean(event && (event.created_by === user.id || group?.admin_id === user.id));

  return (
    <Screen>
      <Header title={event?.kind === 'trip' ? 'Modifica vacanza' : 'Modifica evento'} />
      {data.data === undefined ? (
        <ActivityIndicator color={colors.brand} className="mt-10" />
      ) : !event || !group || !canEdit ? (
        <Text className="p-4 text-stone-600">Solo chi l’ha organizzato o l’admin del gruppo può modificarlo.</Text>
      ) : (
        <EditForm event={event} group={group} />
      )}
    </Screen>
  );
}

function EditForm({ event, group }: { event: EventWithGroup; group: Group }) {
  const isTrip = event.kind === 'trip';
  const start = new Date(event.date_time);
  const [title, setTitle] = useState(event.title);
  const [month, setMonth] = useState(start);
  const [day, setDay] = useState(dayKey(start));
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: dayKey(start),
    end: dayKey(new Date(event.ends_at ?? event.date_time)),
  });
  const [time, setTime] = useState(start.toTimeString().slice(0, 5));
  const [place, setPlace] = useState<PlaceValue>({ text: event.location, lat: event.lat, lon: event.lon });
  const [tags, setTags] = useState(event.tags);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setError(undefined);
    let dates: { date_time: string; ends_at?: string };
    if (isTrip) {
      if (!range.start) return setError('Scegli il primo e l’ultimo giorno sul calendario');
      const first = fromDayKey(range.start);
      first.setHours(9);
      const last = fromDayKey(range.end ?? range.start);
      last.setHours(21);
      dates = { date_time: first.toISOString(), ends_at: last.toISOString() };
    } else {
      const parsed = parseTime(time);
      if (!parsed) return setError('Scrivi l’orario come 19:30');
      const when = fromDayKey(day);
      when.setHours(Number(parsed.slice(0, 2)), Number(parsed.slice(3)));
      dates = { date_time: when.toISOString() };
    }
    setLoading(true);
    try {
      await api.updateEvent(event.id, {
        title: title.trim(),
        ...dates,
        location: place.text.trim(),
        lat: place.lat,
        lon: place.lon,
        tags,
        visibility: group.visibility === 'private' ? 'private' : visibility,
      });
      // opened from a link or after a reload there's no page behind: go to the event
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="gap-5 px-4 py-5" keyboardShouldPersistTaps="handled">
        {event.series_id ? (
          <Text className="rounded-2xl bg-violet-50 p-3 text-sm text-violet-900">
            🔁 È una data di un evento ricorrente: le modifiche valgono solo per questa data.
          </Text>
        ) : null}
        <TextField label="Titolo" value={title} onChangeText={setTitle} />

        <View className="gap-2">
          <Text className="text-sm font-medium text-stone-700">
            {isTrip
              ? range.start
                ? `🏖️ ${tripDatesLabel(fromDayKey(range.start).toISOString(), fromDayKey(range.end ?? range.start).toISOString())}${range.end ? '' : ' · ora tocca l’ultimo giorno'}`
                : 'Tocca il primo e l’ultimo giorno'
              : 'Giorno'}
          </Text>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={isTrip ? undefined : day}
            range={isTrip ? range : undefined}
            onDayPress={(d) =>
              isTrip
                ? setRange(({ start: s, end }) => (!s || end || d < s ? { start: d, end: null } : { start: s, end: d }))
                : setDay(d)
            }
          />
        </View>
        {isTrip ? null : (
          <TextField label="Ora" value={time} onChangeText={setTime} placeholder="19:30" keyboardType="numbers-and-punctuation" />
        )}
        <PlaceField
          label={isTrip ? 'Destinazione' : 'Luogo'}
          value={place}
          onChange={setPlace}
          hint="Scegli dai suggerimenti per collegarlo alla mappa."
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
                  onPress={() => setTags(selected ? tags.filter((t) => t !== interest) : tags.length < 3 ? [...tags, interest] : tags)}
                />
              );
            })}
          </View>
        </View>

        <VisibilityChoice groupIsPrivate={group.visibility === 'private'} value={visibility} onChange={setVisibility} isTrip={isTrip} />

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        <Button title="Salva le modifiche" icon="checkmark" onPress={save} loading={loading} />
        <Text className="text-center text-sm text-stone-500">Se cambi data o luogo, chi ha detto “Ci sono” riceve una notifica.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
