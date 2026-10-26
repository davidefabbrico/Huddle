// SmartPark on the event page:
//  • "Trova parcheggio": opens SmartPark on the event place, estimating parking for the event time
//  • back from SmartPark (?smartpark=arrivato&auto=lat,lon): "you parked near the event" with the choices
//    to check in and to show your passengers where the car is (nothing happens unless you tap)

import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appUrl } from '../lib/appUrl';
import type { EventPhase } from '../lib/eventTiming';
import { distanceMeters, formatDistance, type LatLon } from '../lib/geo';
import { geocodeFirst } from '../lib/geocode';
import { parkingUrl } from '../lib/smartpark';
import type { AttendeeWithProfile, EventWithGroup } from '../lib/types';
import { Button } from './Button';
import { colors } from './theme';

interface Props {
  event: EventWithGroup;
  phase: EventPhase;
  me: AttendeeWithProfile | undefined;
  arrival: LatLon | null; // where SmartPark saw you park
  sharedCar: boolean; // your car spot is already shared
  busy: boolean;
  onCheckIn: () => void;
  onShareCar: (spot: LatLon) => void;
  onDismissArrival: () => void;
}

export function SmartParkCard({ event, phase, me, arrival, sharedCar, busy, onCheckIn, onShareCar, onDismissArrival }: Props) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const eventPlace = event.lat !== null && event.lon !== null ? { lat: event.lat, lon: event.lon } : null;

  async function openSmartPark() {
    setError(undefined);
    setOpening(true);
    // Events created without picking an address: try the text
    const place = eventPlace ?? (event.location ? await geocodeFirst(event.location) : null);
    setOpening(false);
    if (!place) return setError('Non trovo il luogo dell’evento sulla mappa: chiedi a chi organizza di indicare l’indirizzo.');
    Linking.openURL(parkingUrl(event, place, appUrl(`/event/${event.id}`)));
  }

  return (
    <View className="gap-3">
      {arrival ? (
        <View className="gap-3 rounded-3xl border border-sky-200 bg-sky-50 p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
              <Text className="text-lg font-extrabold text-white">P</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-ink">SmartPark: hai parcheggiato</Text>
              <Text className="text-sm text-stone-600">
                {eventPlace ? `A ${formatDistance(distanceMeters(arrival, eventPlace))} dall’evento.` : 'Vicino all’evento.'} Cosa vuoi fare?
              </Text>
            </View>
            <Pressable onPress={onDismissArrival} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          {phase === 'live' && !me?.checked_in ? (
            <Button title="Sono qui! Fai check-in" icon="location" size="sm" disabled={busy} onPress={onCheckIn} />
          ) : phase === 'upcoming' ? (
            <Text className="text-xs text-stone-500">Il check-in si apre un’ora prima dell’evento.</Text>
          ) : null}
          {me?.transport === 'car' ? (
            sharedCar ? (
              <Text className="text-sm text-emerald-700">✓ I tuoi passeggeri vedono dove hai lasciato l’auto.</Text>
            ) : (
              <Button
                title="Mostra ai passeggeri dove ho lasciato l’auto"
                icon="car"
                size="sm"
                variant="secondary"
                disabled={busy}
                onPress={() => onShareCar(arrival)}
              />
            )
          ) : null}
        </View>
      ) : null}

      {phase !== 'ended' ? (
        <View className="gap-1">
          <Pressable
            onPress={openSmartPark}
            disabled={opening}
            accessibilityRole="link"
            className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 active:bg-stone-100"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
              <Text className="text-lg font-extrabold text-white">P</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-ink">{opening ? 'Cerco il luogo…' : 'Trova parcheggio'}</Text>
              <Text className="text-xs text-stone-500">Con SmartPark, per l’ora dell’evento</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
