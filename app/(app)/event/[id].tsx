// Event detail: info, "Ci sono" / "Non ci sono", check-in while it's live, who's in / out / hasn't answered,
// and "Grazie" to the organizer and to the people who came (points for them).
// The organizer and the group admin can add a poster or delete the event.
// Getting there: "Trova parcheggio" with SmartPark, carpool ("Come ci arrivi?"), and the "you parked" card
// when SmartPark sends you back here (?smartpark=arrivato&auto=lat,lon).
// Occurrence of a recurring event: when it repeats and "Ci sono ogni volta" (SeriesCard).
// Holiday ("Vacanza"): the plan of things to do/see (TripPlan). Photos (one per person) and shared
// expenses ("Spese": always on holidays, on events if the group turned them on).
// On a computer: the event and your answer on the left, getting there and who's coming on the right.

import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { CarpoolSection } from '../../../components/CarpoolSection';
import { EventPhotos } from '../../../components/EventPhotos';
import { ExpensesSection } from '../../../components/ExpensesSection';
import { TripPlan } from '../../../components/TripPlan';
import { Columns } from '../../../components/Columns';
import { GroupIcon } from '../../../components/GroupIcon';
import { Header } from '../../../components/Header';
import { PosterView } from '../../../components/PosterView';
import { Screen } from '../../../components/Screen';
import { SeriesCard } from '../../../components/SeriesCard';
import { SmartParkCard } from '../../../components/SmartParkCard';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { eventPhase } from '../../../lib/eventTiming';
import { dayKeysBetween, firstName, formatEventDate, tripDatesLabel } from '../../../lib/format';
import { parseLatLon } from '../../../lib/geo';
import { pickPoster } from '../../../lib/pickers';
import { POINTS } from '../../../lib/points';
import type { Rank } from '../../../lib/ranks';
import type { RsvpStatus, User } from '../../../lib/types';

type Person = User & { checked_in?: boolean };

export default function EventScreen() {
  const { id, smartpark, auto } = useLocalSearchParams<{ id: string; smartpark?: string; auto?: string }>();
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  const arrival = smartpark === 'arrivato' && !arrivalDismissed ? parseLatLon(auto) : null;
  const user = useAuth((state) => state.user)!;
  const [version, setVersion] = useState(0); // bump to refetch after an action
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [newRank, setNewRank] = useState<Rank | null>(null);

  const data = useAsync(async () => {
    const event = await api.getEventById(id);
    if (!event) return null;
    const [access, group, members, attendees, thanks, carSpots, regulars] = await Promise.all([
      api.canAccessChat(event.group_id),
      api.getGroupById(event.group_id),
      api.getGroupMembers(event.group_id),
      api.getEventAttendees(id),
      api.getEventThanks(id),
      api.getCarSpots(id),
      event.series_id ? api.getSeriesRegulars(event.series_id) : Promise.resolve([]),
    ]);
    const withExpenses = access && (event.kind === 'trip' || Boolean(group?.expenses_enabled));
    const [organizer, photos, tripItems, expenses] = await Promise.all([
      event.created_by ? (members.find((m) => m.id === event.created_by) ?? api.getUserById(event.created_by)) : null,
      api.getEventPhotos(id),
      access && event.kind === 'trip' ? api.getTripItems(id) : Promise.resolve([]),
      withExpenses ? api.getExpenses(id) : Promise.resolve(null),
    ]);
    return { event, access, group, members, attendees, thanks, carSpots, regulars, organizer, photos, tripItems, expenses };
  }, [id, version]);

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Qualcosa è andato storto');
    } finally {
      setBusy(false);
    }
  }

  if (data.data === undefined || data.data === null) {
    return (
      <Screen>
        <Header title="Evento" />
        {data.data === null ? (
          <Text className="p-4 text-stone-600">Questo evento non esiste più.</Text>
        ) : data.error ? (
          <Text className="p-4 text-red-600">{data.error}</Text>
        ) : (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        )}
      </Screen>
    );
  }

  const { event, access, group, members, attendees, thanks, carSpots, regulars, organizer, photos, tripItems, expenses } = data.data;
  const reload = () => setVersion((v) => v + 1);
  const people = [...members, ...attendees];
  const phase = eventPhase(event.date_time, event.ends_at);
  const mine = attendees.find((a) => a.id === user.id);
  const going = attendees.filter((a) => a.status === 'going');
  const notGoing = attendees.filter((a) => a.status === 'not_going');
  const noAnswer = members.filter((m) => !attendees.some((a) => a.id === m.id));
  const canManage = event.created_by === user.id || group?.admin_id === user.id;
  const canThank = access && phase !== 'upcoming'; // once the event has started
  const thanked = (toUser: string) => thanks.some((t) => t.from_user === user.id && t.to_user === toUser);
  const thanksFor = (toUser: string) => thanks.filter((t) => t.to_user === toUser).length;

  const answer = (status: RsvpStatus | null) => run(() => api.setRsvp(user.id, event.id, status));
  const checkIn = () =>
    run(async () => {
      const result = await api.checkIn(user.id, event);
      setNewRank(result.newRank);
    });
  const toggleThanks = (person: User) =>
    run(() => (thanked(person.id) ? api.removeThanks(event.id, user.id, person.id) : api.sendThanks(event.id, user.id, person.id)));

  return (
    <Screen width="wide">
      <Header title={event.title} subtitle={event.group_name} />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-5 wide:px-8 wide:pt-8">
        <Columns
          main={
            <>
              <View className="gap-3 rounded-3xl border border-stone-200 bg-white p-4">
                {phase === 'live' ? <Badge label="In corso" tone="green" icon="radio-button-on" /> : null}
                {phase === 'ended' ? <Badge label="Concluso" icon="checkmark-done" /> : null}
                <Text className="text-2xl font-bold text-ink">{event.title}</Text>
                {event.kind === 'trip' ? <Badge label="Vacanza" tone="sky" icon="airplane" /> : null}
                <InfoRow
                  icon="time-outline"
                  text={event.kind === 'trip' ? tripDatesLabel(event.date_time, event.ends_at) : formatEventDate(event.date_time)}
                />
                {event.location ? <InfoRow icon="location-outline" text={event.location} /> : null}
                {organizer ? (
                  <View className="flex-row items-center gap-2">
                    <Avatar {...avatarOf(organizer)} size={24} />
                    <Text className="flex-1 text-base text-stone-700">
                      Organizza <Text className="font-semibold">{organizer.id === user.id ? 'tu' : organizer.full_name}</Text>
                    </Text>
                  </View>
                ) : null}
                <Link href={{ pathname: '/group/[id]', params: { id: event.group_id } }} asChild>
                  <Pressable className="mt-1 flex-row items-center gap-3 rounded-2xl bg-stone-50 p-3 active:bg-stone-100">
                    <GroupIcon name={event.group_name} icon={event.group_icon} color={event.group_color} size={36} />
                    <Text className="flex-1 font-semibold text-ink">{event.group_name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                </Link>
              </View>

              {event.poster_url ? <PosterView url={event.poster_url} mime={event.poster_mime} /> : null}

              {newRank ? (
                <View className="items-center gap-1 rounded-3xl bg-amber-100 p-5">
                  <Text className="text-4xl">{newRank.emoji}</Text>
                  <Text className="text-center text-lg font-bold text-amber-900">Nuovo grado: {newRank.name}!</Text>
                  <Text className="text-center text-sm text-amber-800">{newRank.description}</Text>
                </View>
              ) : null}

              {/* Your answer */}
              {!access ? (
                <View className="gap-2">
                  <Button
                    title="Entra nel gruppo per rispondere"
                    icon="person-add"
                    onPress={() => router.push({ pathname: '/group/[id]', params: { id: event.group_id } })}
                  />
                  <Text className="text-center text-sm text-stone-500">Anche da ospite puoi venire agli eventi.</Text>
                </View>
              ) : phase === 'ended' ? (
                <Button title={mine?.status === 'going' ? 'C’eri anche tu ✓' : 'Evento concluso'} variant="muted" disabled />
              ) : (
                <View className="gap-3">
                  <Text className="text-base font-semibold text-ink">Ci sei?</Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        title="Ci sono"
                        icon="checkmark-circle"
                        variant={mine?.status === 'going' ? 'primary' : 'secondary'}
                        disabled={busy || mine?.checked_in}
                        onPress={() => answer(mine?.status === 'going' ? null : 'going')}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Non ci sono"
                        icon="close-circle"
                        variant={mine?.status === 'not_going' ? 'primary' : 'secondary'}
                        disabled={busy || mine?.checked_in}
                        onPress={() => answer(mine?.status === 'not_going' ? null : 'not_going')}
                      />
                    </View>
                  </View>
                  {phase === 'live' ? (
                    mine?.checked_in ? (
                      <Button title="Check-in fatto ✓" icon="location" variant="muted" disabled />
                    ) : arrival ? null /* the SmartPark card below has the check-in button */ : (
                      <Button title="Sono qui! Fai check-in" icon="location" loading={busy} onPress={checkIn} />
                    )
                  ) : null}
                </View>
              )}
              {error ? <Text className="text-center text-sm text-red-600">{error}</Text> : null}

              {event.series && event.series_id ? (
                <SeriesCard
                  series={event.series}
                  regulars={regulars}
                  people={[...members, ...attendees]}
                  myId={user.id}
                  canAnswer={access && phase !== 'ended'}
                  canStop={event.series.created_by === user.id || group?.admin_id === user.id}
                  busy={busy}
                  onSetRegular={() => run(() => api.setRegular(event.id))}
                  onRemoveRegular={() => run(() => api.removeRegular(event.id))}
                  onStop={async () => {
                    await api.stopSeries(event.series_id!);
                    if (router.canGoBack()) router.back();
                    else router.replace('/events');
                  }}
                />
              ) : null}

              {event.kind === 'trip' && access ? (
                <TripPlan
                  eventId={event.id}
                  myId={user.id}
                  days={dayKeysBetween(event.date_time, event.ends_at)}
                  items={tripItems}
                  canEdit={access}
                  onChanged={reload}
                />
              ) : null}

              <EventPhotos
                eventId={event.id}
                myId={user.id}
                photos={photos}
                people={people}
                canAdd={access && phase !== 'upcoming'}
                isAdmin={group?.admin_id === user.id}
                isPublic={group?.visibility !== 'private'}
                onChanged={reload}
              />
            </>
          }
          side={
            <>
              {/* Getting there: SmartPark and carpool */}
              {access ? (
                <SmartParkCard
                  event={event}
                  phase={phase}
                  me={mine}
                  arrival={arrival}
                  sharedCar={carSpots.some((s) => s.user_id === user.id)}
                  busy={busy}
                  onCheckIn={checkIn}
                  onShareCar={(spot) => run(() => api.shareCarSpot(user.id, event.id, spot.lat, spot.lon))}
                  onDismissArrival={() => setArrivalDismissed(true)}
                />
              ) : null}
              {access ? (
                <CarpoolSection
                  attendees={attendees}
                  myId={user.id}
                  carSpots={carSpots}
                  canChoose={mine?.status === 'going' && phase !== 'ended'}
                  busy={busy}
                  onTransport={(transport, seats) => run(() => api.setTransport(user.id, event.id, transport, seats))}
                  onDeparture={(area, time) => run(() => api.setDeparture(user.id, event.id, area, time))}
                  onRide={(driverId) => run(() => api.rideWith(user.id, event.id, driverId))}
                  onAnswer={(passengerId, accept) => run(() => api.answerRide(event.id, passengerId, accept))}
                  onStopSharing={() => run(() => api.stopSharingCarSpot(user.id, event.id))}
                />
              ) : null}

              {expenses ? (
                <ExpensesSection
                  eventId={event.id}
                  myId={user.id}
                  expenses={expenses}
                  participants={going.some((a) => a.id === user.id) ? going : [user, ...going]}
                  people={people}
                  isAdmin={group?.admin_id === user.id}
                  ended={phase === 'ended'}
                  onChanged={reload}
                />
              ) : null}

              {/* Who's in / out */}
              {access ? (
                <>
                  <PeopleList
                    title={`Ci sono (${going.length})`}
                    people={going}
                    empty="Ancora nessuno: rompi il ghiaccio!"
                    myId={user.id}
                    right={(person) =>
                      canThank && person.id !== user.id ? (
                        <ThanksButton active={thanked(person.id)} count={thanksFor(person.id)} disabled={busy} onPress={() => toggleThanks(person)} />
                      ) : person.checked_in ? (
                        <Badge label="Qui" tone="green" icon="location" />
                      ) : thanksFor(person.id) > 0 ? (
                        <Text className="text-sm text-stone-500">🙏 {thanksFor(person.id)}</Text>
                      ) : null
                    }
                  />
                  {canThank ? (
                    <Text className="-mt-2 text-xs text-stone-500">
                      Ringrazia chi ha organizzato e chi c’era: ogni grazie vale {POINTS.thanksReceived} punti per chi lo riceve.
                    </Text>
                  ) : null}
                  {notGoing.length > 0 ? <PeopleList title={`Non ci sono (${notGoing.length})`} people={notGoing} myId={user.id} /> : null}
                  {noAnswer.length > 0 && phase !== 'ended' ? (
                    <View className="gap-2">
                      <Text className="text-base font-semibold text-ink">Non hanno ancora risposto ({noAnswer.length})</Text>
                      <Text className="text-sm text-stone-500">{noAnswer.map((m) => firstName(m.full_name)).join(', ')}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text className="text-stone-500">Entra nel gruppo per vedere chi partecipa.</Text>
              )}

              {/* Organizer / admin tools */}
              {canManage ? (
                <View className="gap-2 rounded-3xl border border-stone-200 p-3">
                  <Text className="text-sm font-semibold text-stone-600">Gestisci l’evento</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      title={event.poster_url ? 'Cambia locandina' : 'Aggiungi locandina'}
                      icon="attach"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          const file = await pickPoster();
                          if (file) await api.setEventPoster(event, file);
                        })
                      }
                    />
                    {event.poster_url ? (
                      <Button
                        title="Togli locandina"
                        size="sm"
                        variant="muted"
                        disabled={busy}
                        onPress={() => run(async () => void (await api.setEventPoster(event, null)))}
                      />
                    ) : null}
                    <DeleteEventButton
                      disabled={busy}
                      onConfirm={() =>
                        run(async () => {
                          await api.deleteEvent(event.id);
                          if (router.canGoBack()) router.back();
                          else router.replace('/events');
                        })
                      }
                    />
                  </View>
                </View>
              ) : null}
            </>
          }
        />
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon, text }: { icon: 'time-outline' | 'location-outline'; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text className="flex-1 text-base text-stone-700">{text}</Text>
    </View>
  );
}

interface PeopleListProps {
  title: string;
  people: Person[];
  myId: string;
  empty?: string;
  right?: (person: Person) => ReactNode;
}

function PeopleList({ title, people, myId, empty, right }: PeopleListProps) {
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-ink">{title}</Text>
      {people.length === 0 ? (
        empty ? <Text className="text-stone-500">{empty}</Text> : null
      ) : (
        <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          {people.map((person, index) => (
            <View key={person.id} className={`flex-row items-center gap-3 p-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
              <Avatar {...avatarOf(person)} size={36} />
              <Text className="flex-1 font-medium text-ink">
                {person.full_name}
                {person.id === myId ? ' (tu)' : ''}
              </Text>
              {right?.(person)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// 🙏 toggle with the number of thanks the person received for this event
function ThanksButton({ active, count, disabled, onPress }: { active: boolean; count: number; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Togli il grazie' : 'Ringrazia'}
      className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${active ? 'border-amber-400 bg-amber-100' : 'border-stone-300 bg-white active:bg-stone-100'}`}
    >
      <Text className="text-sm">🙏</Text>
      <Text className={`text-sm font-semibold ${active ? 'text-amber-800' : 'text-stone-600'}`}>
        {active ? 'Grazie!' : 'Grazie'}
        {count > 0 ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

// Two taps to delete: the first one asks for confirmation
function DeleteEventButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <View className="flex-row gap-2">
      <Button title="Conferma eliminazione" icon="trash" size="sm" disabled={disabled} onPress={onConfirm} />
      <Button title="Annulla" size="sm" variant="muted" onPress={() => setConfirming(false)} />
    </View>
  ) : (
    <Button title="Elimina evento" icon="trash-outline" size="sm" variant="muted" disabled={disabled} onPress={() => setConfirming(true)} />
  );
}
