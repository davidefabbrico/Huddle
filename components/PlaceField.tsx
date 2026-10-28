// Place input with address suggestions (OpenStreetMap). Picking a suggestion stores the coordinates,
// which "Trova parcheggio" (SmartPark) uses; typing again clears them.

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchPlaces, type Place } from '../lib/geocode';
import { TextField } from './TextField';
import { colors } from './theme';

export interface PlaceValue {
  text: string;
  lat: number | null;
  lon: number | null;
}

interface Props {
  label: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  placeholder?: string;
  hint?: string; // under the field, until a suggestion is picked
  foundHint?: string; // once a suggestion is picked
}

const DEBOUNCE_MS = 600; // Nominatim allows about one request per second

export function PlaceField({
  label,
  value,
  onChange,
  placeholder,
  hint = 'Scegli un indirizzo dai suggerimenti per collegare l’evento alla mappa.',
  foundHint = 'Posizione trovata: “Trova parcheggio” porterà qui',
}: Props) {
  // Suggestions belong to the text they were searched for: stale ones are simply not shown
  const [found, setFound] = useState<{ query: string; places: Place[] }>({ query: '', places: [] });
  const picked = value.lat !== null && value.lon !== null;
  const searchable = !picked && value.text.trim().length >= 3;
  const results = searchable && found.query === value.text ? found.places : [];

  useEffect(() => {
    if (!searchable) return;
    let active = true;
    const query = value.text;
    const timer = setTimeout(() => {
      searchPlaces(query)
        .then((places) => active && setFound({ query, places }))
        .catch(() => active && setFound({ query, places: [] }));
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value.text, searchable]);

  return (
    <View className="gap-2">
      <TextField
        label={label}
        value={value.text}
        onChangeText={(text) => onChange({ text, lat: null, lon: null })}
        placeholder={placeholder}
        autoCorrect={false}
      />
      {picked ? (
        <View className="flex-row items-center gap-1">
          <Ionicons name="location" size={14} color={colors.green} />
          <Text className="text-xs text-emerald-700">{foundHint}</Text>
        </View>
      ) : results.length > 0 ? (
        <View className="overflow-hidden rounded-2xl bg-white">
          {results.map((place, index) => (
            <Pressable
              key={`${place.lat},${place.lon}`}
              onPress={() => onChange({ text: place.label, lat: place.lat, lon: place.lon })}
              accessibilityRole="button"
              className={`flex-row items-center gap-2 px-3 py-2.5 active:bg-stone-100 ${index > 0 ? 'border-t border-stone-100' : ''}`}
            >
              <Ionicons name="location-outline" size={16} color={colors.muted} />
              <Text numberOfLines={2} className="flex-1 text-sm text-ink">
                {place.full}
              </Text>
            </Pressable>
          ))}
          <Text className="px-3 py-1.5 text-right text-[10px] text-stone-400">© OpenStreetMap</Text>
        </View>
      ) : searchable ? (
        <Text className="text-xs text-stone-500">{hint}</Text>
      ) : null}
    </View>
  );
}
