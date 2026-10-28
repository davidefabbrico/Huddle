// Eventi tab: upcoming events from your groups (first) or from everyone, grouped by day; "Per te"
// (suggestions with the reason, lib/recommendations.ts); and "Ci vado": your agenda with a month calendar.
// Cards in a grid on wide screens.

import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { AgendaView } from '../../../components/AgendaView';
import { Chip } from '../../../components/Chip';
import { Grid } from '../../../components/Columns';
import { InfoTip } from '../../../components/InfoTip';
import { NewsletterCard } from '../../../components/NewsletterCard';
import { EventCard } from '../../../components/EventCard';
import { Screen } from '../../../components/Screen';
import { SearchButton } from '../../../components/SearchButton';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { dayLabel } from '../../../lib/format';
import { recommendEvents, weeklyPicks } from '../../../lib/recommendations';
import type { EventWithGroup } from '../../../lib/types';

type Filter = 'forYou' | 'going' | 'all' | 'mine';

export default function EventsScreen() {
  const user = useAuth((state) => state.user)!;
  const [filter, setFilter] = useState<Filter>('mine');

  const data = useAsync(
    async () => {
      const [events, memberships, answers, signals, agenda, settings] = await Promise.all([
        api.getUpcomingEvents(100),
        api.getMemberships(user.id),
        api.getMyAnswers(user.id),
        api.getForYouSignals(),
        api.getMyAgenda(user.id),
        api.getMySettings(user.id),
        api.sendNewsletterIfDue(), // the weekly newsletter in Attività, at most once a week
      ]);
      const myGroupIds = new Set(memberships.map((m) => m.group.id));
      const recommended = recommendEvents(events, user, answers, myGroupIds, signals);
      // "La tua settimana" uses the fuller "Per te" reason when there is one ("ti piace: cinema · ci va…"),
      // and what's in it isn't repeated in the suggestions below
      const reasons = new Map(recommended.map((s) => [s.event.id, s.reason.charAt(0).toLowerCase() + s.reason.slice(1)]));
      const weekly = settings.newsletter
        ? weeklyPicks(events, user, answers, settings).map((p) => {
            const reason = reasons.get(p.event.id);
            // keep the distance ("a 2,3 km"), it's the point of a newsletter about nearby events
            return { ...p, why: !reason ? p.why : p.why.startsWith('a ') ? `${p.why} · ${reason}` : reason };
          })
        : null;
      const inWeekly = new Set(weekly?.map((p) => p.event.series_id ?? p.event.id));
      const suggestions = recommended.filter((s) => !inWeekly.has(s.event.series_id ?? s.event.id));
      return { events, answers, myGroupIds, agenda, settings, weekly, suggestions };
    },
    [user.id],
    { refetchOnFocus: true },
  );

  const events = (data.data?.events ?? []).filter((e) => filter === 'all' || data.data?.myGroupIds.has(e.group_id));
  const suggestions = data.data?.suggestions ?? [];

  // Events are already sorted by date: split them into consecutive days
  const days: { label: string; events: EventWithGroup[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.date_time);
    if (days.at(-1)?.label === label) days.at(-1)!.events.push(event);
    else days.push({ label, events: [event] });
  }

  return (
    <Screen width="wide">
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-3 wide:px-8 wide:pt-8">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-2xl font-semibold text-ink">Eventi</Text>
          <SearchButton />
        </View>

        {/* Filters on one scrolling row (Material chips); the ⓘ stays outside so its bubble isn't clipped */}
        <View className="z-10 flex-row items-center gap-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="gap-2">
            <Chip label="Dei miei gruppi" selected={filter === 'mine'} onPress={() => setFilter('mine')} />
            <Chip label="✨ Per te" selected={filter === 'forYou'} onPress={() => setFilter('forYou')} />
            <Chip label="Tutti" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="📅 Ci vado" selected={filter === 'going'} onPress={() => setFilter('going')} />
          </ScrollView>
          {filter === 'forYou' ? (
            <InfoTip text="Eventi scelti per te dai tuoi interessi e da cosa piace a chi è nei tuoi gruppi. Solo quelli a cui non hai ancora risposto." />
          ) : null}
        </View>

        {!data.data && data.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : data.error ? (
          <Text className="text-red-600">{data.error}</Text>
        ) : filter === 'going' ? (
          <AgendaView events={data.data?.agenda ?? []} />
        ) : filter === 'forYou' ? (
          <View className="gap-5">
            {data.data?.weekly ? <NewsletterCard picks={data.data.weekly} hasArea={data.data.settings.area_lat != null} /> : null}
            {suggestions.length === 0 ? (
              <Text className="mt-6 text-center text-stone-500">
                Nessun suggerimento: hai già risposto a tutti gli eventi in programma. Aggiungi interessi al profilo per scoprirne altri.
              </Text>
            ) : (
              <View className="gap-3">
                <Grid>
                  {suggestions.map((s) => (
                    <EventCard key={s.event.id} event={s.event} showGroup reason={s.reason} outside={s.outside} />
                  ))}
                </Grid>
              </View>
            )}
          </View>
        ) : days.length === 0 ? (
          <Text className="mt-6 text-center text-stone-500">
            {filter === 'mine' ? 'Nessun evento in programma nei tuoi gruppi.' : 'Nessun evento in programma.'}
          </Text>
        ) : (
          days.map((day) => (
            <View key={day.label} className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-wide text-stone-500">{day.label}</Text>
              <Grid>
                {day.events.map((event) => (
                  <EventCard key={event.id} event={event} showGroup answer={data.data?.answers[event.id]} />
                ))}
              </Grid>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
