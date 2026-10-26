// New event form: any member can organize in their groups. Optional ?groupId= preselects the group.
// Date = a chip for each of the next 14 days; time = "HH:MM" text (no extra libraries needed).
// Optional poster ("locandina"): a PDF or an image.

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
import { isInPast } from '../../lib/eventTiming';
import { isPdf, pickPoster } from '../../lib/pickers';
import type { PickedFile } from '../../lib/types';

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
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const user = useAuth((state) => state.user)!;
  const memberships = useAsync(() => api.getMemberships(user.id), [user.id]);

  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(groupId);
  const [title, setTitle] = useState('');
  const [dayIndex, setDayIndex] = useState(1); // tomorrow
  const [time, setTime] = useState('19:30');
  const [place, setPlace] = useState<PlaceValue>({ text: '', lat: null, lon: null });
  const [poster, setPoster] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const days = nextDays();

  const groups = memberships.data ?? [];
  const groupIdToUse = selectedGroup ?? (groups.length === 1 ? groups[0].group.id : undefined);

  async function handleCreate() {
    setError(undefined);
    const match = time.trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (!groupIdToUse) return setError('Scegli il gruppo');
    if (!match) return setError('Scrivi l’orario come 19:30');
    const start = new Date(days[dayIndex].date);
    start.setHours(Number(match[1]), Number(match[2]));
    if (isInPast(start)) return setError('Scegli un orario nel futuro');

    setLoading(true);
    try {
      const event = await api.createEvent(user.id, {
        group_id: groupIdToUse,
        title,
        location: place.text,
        lat: place.lat,
        lon: place.lon,
        date_time: start.toISOString(),
        poster,
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
        <Header title="Nuovo evento" />
        <ActivityIndicator color={colors.brand} className="mt-10" />
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <Header title="Nuovo evento" />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-center text-stone-600">Per organizzare un evento entra in un gruppo, oppure creane uno tuo.</Text>
          <Button title="Crea un gruppo" icon="people" onPress={() => router.replace('/create-group')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Nuovo evento" />
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

          <TextField label="Titolo" value={title} onChangeText={setTitle} placeholder="Es. Corsa serale 6 km" />

          <View className="gap-2">
            <Text className="text-sm font-medium text-stone-700">Giorno</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {days.map((day, index) => (
                <Chip key={day.label} label={day.label} selected={dayIndex === index} onPress={() => setDayIndex(index)} />
              ))}
            </ScrollView>
          </View>

          <TextField label="Ora" value={time} onChangeText={setTime} placeholder="19:30" keyboardType="numbers-and-punctuation" />
          <PlaceField label="Luogo" value={place} onChange={setPlace} placeholder="Es. Via Pascal 12, Milano" />

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
          <Button title="Crea evento" icon="calendar" onPress={handleCreate} loading={loading} />
          <Text className="text-center text-sm text-stone-500">I membri del gruppo riceveranno una notifica.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
