// "Come ci arrivi?": drivers offer seats and say where and when they leave (an area and a time,
// never a live position); passengers ask a driver, who accepts or declines. The driver can show
// the accepted passengers where the car is parked (shared from SmartPark, visible only to them).

import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firstName, parseTime, shortTime } from '../lib/format';
import { mapsUrl } from '../lib/geo';
import { POINTS } from '../lib/points';
import type { AttendeeWithProfile, CarSpot, Transport } from '../lib/types';
import { Avatar, avatarOf } from './Avatar';
import { Button } from './Button';
import { Chip } from './Chip';
import { TextField } from './TextField';
import { colors } from './theme';

interface Props {
  attendees: AttendeeWithProfile[];
  myId: string;
  carSpots: CarSpot[];
  canChoose: boolean; // you said "Ci sono" and the event hasn't ended
  busy: boolean;
  onTransport: (transport: Transport, seats?: number) => void;
  onDeparture: (area: string | null, time: string | null) => void;
  onRide: (driverId: string | null) => void; // ask a driver (null = withdraw / get out)
  onAnswer: (passengerId: string, accept: boolean) => void; // driver: accept or decline a request
  onStopSharing: () => void;
}

const MAX_SEATS = 8;

export function CarpoolSection({ attendees, myId, carSpots, canChoose, busy, onTransport, onDeparture, onRide, onAnswer, onStopSharing }: Props) {
  const going = attendees.filter((a) => a.status === 'going');
  const me = going.find((a) => a.id === myId);
  const drivers = going.filter((a) => a.transport === 'car');
  const passengersOf = (driverId: string) => going.filter((a) => a.ride_with === driverId && a.ride_status === 'accepted');
  const requestsTo = (driverId: string) => going.filter((a) => a.ride_with === driverId && a.ride_status === 'requested');
  const looking = going.filter((a) => a.transport === 'need_ride' && a.ride_status !== 'accepted');
  const mySpot = carSpots.find((s) => s.user_id === myId);
  const myDriver = me?.ride_with && me.ride_status === 'accepted' ? going.find((a) => a.id === me.ride_with) : undefined;
  const driverSpot = myDriver ? carSpots.find((s) => s.user_id === myDriver.id) : undefined;
  const myRequests = me?.transport === 'car' ? requestsTo(myId) : [];

  if (!canChoose && drivers.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-ink">Come ci arrivi?</Text>

      {canChoose && me ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            <Chip label="🚗 In auto" selected={me.transport === 'car'} onPress={busy ? undefined : () => onTransport('car', Math.max(me.seats, 1))} />
            <Chip label="🙋 Mi serve un passaggio" selected={me.transport === 'need_ride'} onPress={busy ? undefined : () => onTransport('need_ride')} />
            <Chip label="🚶 Per conto mio" selected={me.transport === 'own'} onPress={busy ? undefined : () => onTransport('own')} />
          </View>
          {me.transport === 'car' ? (
            <>
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm text-stone-600">Posti liberi per gli amici</Text>
                <Button title="−" size="sm" variant="secondary" disabled={busy || me.seats <= 0} onPress={() => onTransport('car', me.seats - 1)} />
                <Text className="w-6 text-center text-base font-bold text-ink">{me.seats}</Text>
                <Button title="+" size="sm" variant="secondary" disabled={busy || me.seats >= MAX_SEATS} onPress={() => onTransport('car', me.seats + 1)} />
              </View>
              <DepartureForm
                // re-mount when the saved values change, so the fields show them
                key={`${me.depart_area ?? ''}|${me.depart_time ?? ''}`}
                area={me.depart_area}
                time={me.depart_time}
                busy={busy}
                onSave={onDeparture}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {/* Driver: requests waiting for you */}
      {canChoose && myRequests.length > 0 ? (
        <View className="gap-2 rounded-3xl bg-sky-50 p-3">
          <Text className="text-sm font-semibold text-sky-900">Ti chiedono un passaggio</Text>
          {myRequests.map((passenger) => (
            <View key={passenger.id} className="flex-row items-center gap-3">
              <Avatar {...avatarOf(passenger)} size={32} />
              <Text className="flex-1 font-medium text-ink">{passenger.full_name}</Text>
              <Button title="Accetta" icon="checkmark" size="sm" disabled={busy} onPress={() => onAnswer(passenger.id, true)} />
              <Button title="No" size="sm" variant="muted" disabled={busy} onPress={() => onAnswer(passenger.id, false)} />
            </View>
          ))}
        </View>
      ) : null}

      {drivers.length > 0 ? (
        <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          {drivers.map((driver, index) => {
            const passengers = passengersOf(driver.id);
            const free = driver.seats - passengers.length;
            const asked = me?.ride_with === driver.id;
            return (
              <View key={driver.id} className={`gap-2 p-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
                <View className="flex-row items-center gap-3">
                  <Avatar {...avatarOf(driver)} size={36} />
                  <View className="flex-1">
                    <Text className="font-semibold text-ink">
                      🚗 {driver.id === myId ? 'Tu' : driver.full_name}
                    </Text>
                    {driver.depart_area || driver.depart_time ? (
                      <Text className="text-xs text-stone-600">
                        Parte{driver.depart_area ? ` da ${driver.depart_area}` : ''}
                        {driver.depart_time ? ` alle ${shortTime(driver.depart_time)}` : ''}
                      </Text>
                    ) : null}
                    <Text className="text-xs text-stone-500">
                      {free > 0 ? `${free} ${free === 1 ? 'posto libero' : 'posti liberi'}` : 'Auto piena'}
                      {passengers.length ? ` · con ${passengers.map((p) => (p.id === myId ? 'te' : firstName(p.full_name))).join(', ')}` : ''}
                    </Text>
                  </View>
                  {canChoose && me?.transport === 'need_ride' && driver.id !== myId ? (
                    asked ? (
                      me.ride_status === 'accepted' ? (
                        <Button title="Scendi" size="sm" variant="muted" disabled={busy} onPress={() => onRide(null)} />
                      ) : (
                        <Button title="Richiesta inviata · annulla" size="sm" variant="muted" disabled={busy} onPress={() => onRide(null)} />
                      )
                    ) : !me.ride_with && free > 0 ? (
                      <Button title="Chiedi" icon="car" size="sm" disabled={busy} onPress={() => onRide(driver.id)} />
                    ) : null
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {looking.length > 0 ? (
        <Text className="text-sm text-stone-600">
          🙋 Cercano un passaggio: {looking.map((a) => (a.id === myId ? 'tu' : firstName(a.full_name))).join(', ')}
        </Text>
      ) : null}

      {mySpot ? (
        <View className="flex-row flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 p-3">
          <Ionicons name="car" size={18} color={colors.green} />
          <Text className="flex-1 text-sm text-emerald-800">I tuoi passeggeri vedono dove hai lasciato l’auto.</Text>
          <Button title="Apri in Mappe" size="sm" variant="secondary" onPress={() => Linking.openURL(mapsUrl(mySpot))} />
          <Button title="Smetti" size="sm" variant="muted" disabled={busy} onPress={onStopSharing} />
        </View>
      ) : null}
      {driverSpot && myDriver ? (
        <Pressable
          onPress={() => Linking.openURL(mapsUrl(driverSpot))}
          accessibilityRole="link"
          className="flex-row items-center gap-2 rounded-2xl bg-emerald-50 p-3 active:bg-emerald-100"
        >
          <Ionicons name="car" size={18} color={colors.green} />
          <Text className="flex-1 text-sm font-semibold text-emerald-800">
            L’auto di {firstName(myDriver.full_name)} è qui: apri in Mappe
          </Text>
          <Ionicons name="open-outline" size={16} color={colors.green} />
        </Pressable>
      ) : null}

      {canChoose ? (
        <Text className="text-xs text-stone-500">
          Si condividono solo la zona e l’orario di partenza, mai la posizione. Chi dà un passaggio guadagna{' '}
          {POINTS.passenger} punti per ogni passeggero che partecipa.
        </Text>
      ) : null}
    </View>
  );
}

// Driver: "Parto da … alle …" (an area, not an address: it's visible to the group)
function DepartureForm({ area, time, busy, onSave }: {
  area: string | null;
  time: string | null;
  busy: boolean;
  onSave: (area: string | null, time: string | null) => void;
}) {
  const [areaText, setAreaText] = useState(area ?? '');
  const [timeText, setTimeText] = useState(time ? shortTime(time) : '');
  const [error, setError] = useState<string>();
  const changed = areaText.trim() !== (area ?? '') || timeText.trim() !== (time ? shortTime(time) : '');

  function save() {
    const parsed = timeText.trim() ? parseTime(timeText) : null;
    if (timeText.trim() && !parsed) return setError('Scrivi l’orario come 18:30');
    setError(undefined);
    onSave(areaText.trim() || null, parsed);
  }

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-[2]">
          <TextField label="Parto dalla zona" value={areaText} onChangeText={setAreaText} placeholder="Es. Piazza Dante" maxLength={60} />
        </View>
        <View className="flex-1">
          <TextField label="Alle" value={timeText} onChangeText={setTimeText} placeholder="18:30" keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      {changed ? <Button title="Salva partenza" size="sm" variant="secondary" disabled={busy} onPress={save} /> : null}
    </View>
  );
}
