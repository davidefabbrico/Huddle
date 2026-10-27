// Cerca: events and groups by text, distance (from your area in the profile, or your position
// taken once, on the web), age and interests. Filters in lib/search.ts.

import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Grid } from '../../components/Columns';
import { EventCard } from '../../components/EventCard';
import { GroupCard } from '../../components/GroupCard';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { interestOptions } from '../../lib/format';
import { formatDistance, type LatLon } from '../../lib/geo';
import {
  AGE_BRACKETS,
  ageFromBirthYear,
  DISTANCES_KM,
  filterEvents,
  filterGroups,
  kmFrom,
  type AgeBracket,
} from '../../lib/search';

type Tab = 'events' | 'groups';

export default function SearchScreen() {
  const user = useAuth((state) => state.user)!;
  const [tab, setTab] = useState<Tab>('events');
  const [text, setText] = useState('');
  const [maxKm, setMaxKm] = useState<number | null>(null);
  const [age, setAge] = useState<AgeBracket | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [position, setPosition] = useState<LatLon | null>(null); // taken once, never stored
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string>();

  const data = useAsync(async () => {
    const [groups, events, settings] = await Promise.all([api.getGroups(), api.getUpcomingEvents(200), api.getMySettings(user.id)]);
    const reliability = await api.getReliability([], groups.map((g) => g.id));
    return { groups, events, settings, reliability: reliability.groups };
  }, [user.id]);

  const settings = data.data?.settings;
  const area = settings?.area_lat != null && settings.area_lon != null ? { lat: settings.area_lat, lon: settings.area_lon } : null;
  const origin = position ?? area;
  const myAge = settings?.birth_year ? ageFromBirthYear(settings.birth_year) : null;
  const filters = { text, maxKm, origin, age, interests };
  const distanceOf = (place: { lat: number | null; lon: number | null }) => {
    const km = kmFrom(origin, place);
    return km == null ? undefined : formatDistance(km * 1000);
  };
  const byDistance = <T extends { lat: number | null; lon: number | null }>(items: T[]) =>
    origin ? [...items].sort((a, b) => (kmFrom(origin, a) ?? 1e9) - (kmFrom(origin, b) ?? 1e9)) : items;

  const groups = data.data ? byDistance(filterGroups(data.data.groups, filters)) : [];
  const events = data.data ? (maxKm ? byDistance(filterEvents(data.data.events, filters)) : filterEvents(data.data.events, filters)) : [];

  // Web only: the browser's position, once (not saved anywhere)
  function locate() {
    setLocateError(undefined);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocateError('Posizione non disponibile: imposta la tua zona nel profilo.');
        setLocating(false);
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }
  const canLocate = Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return (
    <Screen width="wide">
      <Header title="Cerca" />
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-4 wide:px-8" keyboardShouldPersistTaps="handled">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Cerca eventi, gruppi, luoghi…"
          placeholderTextColor="#A8A29E"
          autoFocus
          className="h-12 rounded-2xl border border-stone-300 bg-white px-4 text-base text-ink"
        />
        <View className="flex-row gap-2">
          <Chip label={`Eventi${data.data ? ` (${events.length})` : ''}`} selected={tab === 'events'} onPress={() => setTab('events')} />
          <Chip label={`Gruppi${data.data ? ` (${groups.length})` : ''}`} selected={tab === 'groups'} onPress={() => setTab('groups')} />
        </View>

        <View className="gap-3 rounded-3xl bg-white p-4">
          <FilterRow label="Distanza">
            <Chip label="Ovunque" selected={maxKm === null} onPress={() => setMaxKm(null)} />
            {DISTANCES_KM.map((km) => (
              <Chip key={km} label={`${km} km`} selected={maxKm === km} onPress={() => setMaxKm(km)} />
            ))}
          </FilterRow>
          <Text className="text-xs text-stone-500">
            {position
              ? 'Distanze dalla tua posizione attuale (non viene salvata).'
              : area
                ? `Distanze da: ${settings?.area}.`
                : 'Per le distanze imposta la tua zona in Modifica profilo.'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {canLocate && !position ? (
              <Button title="Usa la mia posizione" icon="locate" size="sm" variant="secondary" loading={locating} onPress={locate} />
            ) : null}
            {!area ? <Button title="Imposta la tua zona" icon="location-outline" size="sm" variant="muted" onPress={() => router.push('/edit-profile')} /> : null}
          </View>
          {locateError ? <Text className="text-xs text-red-600">{locateError}</Text> : null}

          <FilterRow label="Età">
            <Chip label="Tutte" selected={age === null} onPress={() => setAge(null)} />
            {myAge ? (
              <Chip
                label={`La mia (${myAge})`}
                selected={age?.label === 'mine'}
                onPress={() => setAge({ label: 'mine', min: myAge, max: myAge })}
              />
            ) : null}
            {AGE_BRACKETS.map((bracket) => (
              <Chip key={bracket.label} label={bracket.label} selected={age?.label === bracket.label} onPress={() => setAge(bracket)} />
            ))}
          </FilterRow>

          <FilterRow label="Interessi">
            {interestOptions.map((interest) => {
              const selected = interests.includes(interest);
              return (
                <Chip
                  key={interest}
                  label={interest}
                  selected={selected}
                  onPress={() => setInterests(selected ? interests.filter((i) => i !== interest) : [...interests, interest])}
                />
              );
            })}
          </FilterRow>
        </View>

        {!data.data ? (
          data.error ? <Text className="text-red-600">{data.error}</Text> : <ActivityIndicator color={colors.brand} className="mt-6" />
        ) : (tab === 'events' ? events : groups).length === 0 ? (
          <Text className="mt-4 text-center text-stone-500">
            Nessun risultato.{maxKm && !origin ? ' Per filtrare per distanza serve la tua zona o la tua posizione.' : ' Prova a togliere qualche filtro.'}
          </Text>
        ) : tab === 'events' ? (
          <Grid>
            {events.map((event) => (
              <EventCard key={event.id} event={event} showGroup reason={distanceOf(event) ? `a ${distanceOf(event)}` : undefined} />
            ))}
          </Grid>
        ) : (
          <Grid>
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} reliability={data.data?.reliability[group.id]} distance={distanceOf(group)} />
            ))}
          </Grid>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-stone-600">{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
