// "La nostra storia": what the group has done from its creation to today, as a timeline, with the
// clan's emblem and the legendary cards to collect (easter eggs, lib/mascot.ts). In the group's colors.
// Past events and holidays (how many came, their photos), who joined; a recurring event is one line
// per month ("Palestra serale · 12 volte"). Seen by whoever sees the group (counts only, no attendee names).

import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ClanEmblem } from '../../../../components/GroupMascot';
import { GroupTheme } from '../../../../components/GroupTheme';
import { Header } from '../../../../components/Header';
import { Screen } from '../../../../components/Screen';
import { colors } from '../../../../components/theme';
import { useAsync } from '../../../../hooks/useAsync';
import * as api from '../../../../lib/api';
import { clanOf, legendCards, stageFor, type LegendCard, type Rarity } from '../../../../lib/mascot';
import { firstName, formatDate, monthLabel, tripDatesLabel } from '../../../../lib/format';
import type { GroupHistory } from '../../../../lib/types';

interface Item {
  key: string;
  at: string;
  emoji: string;
  title: string;
  subtitle?: string;
  photos?: string[];
  eventId?: string;
}

// The history as timeline items, oldest first
function timeline(history: GroupHistory, groupName: string): Item[] {
  const items: Item[] = [{ key: 'created', at: history.created_at, emoji: '🎉', title: `Nasce «${groupName}»` }];

  // People who joined on the same day: one line
  const joinedByDay = new Map<string, GroupHistory['members']>();
  for (const m of history.members) {
    const day = m.joined_at.slice(0, 10);
    joinedByDay.set(day, [...(joinedByDay.get(day) ?? []), m]);
  }
  for (const [day, people] of joinedByDay) {
    const names = people.map((p) => firstName(p.full_name));
    items.push({
      key: `join-${day}`,
      at: people[0].joined_at,
      emoji: '👋',
      title: names.length === 1 ? `Entra ${names[0]}` : `Entrano ${names.slice(0, -1).join(', ')} e ${names.at(-1)}`,
    });
  }

  // Recurring events: one line per series and month
  const series = new Map<string, Item & { count: number; going: number }>();
  for (const e of history.events) {
    if (e.series_id) {
      const key = `${e.series_id}-${e.date_time.slice(0, 7)}`;
      const line = series.get(key) ?? { key, at: e.date_time, emoji: '🔁', title: e.title, photos: [], count: 0, going: 0 };
      line.count += 1;
      line.going += e.going;
      line.photos!.push(...e.photos);
      series.set(key, line);
      continue;
    }
    const people = e.going === 1 ? '1 persona' : `${e.going} persone`;
    items.push({
      key: e.id,
      at: e.date_time,
      emoji: e.kind === 'trip' ? '🏖️' : '📅',
      title: e.title,
      subtitle: [e.kind === 'trip' ? tripDatesLabel(e.date_time, e.ends_at) : null, e.location || null, e.going ? people : null]
        .filter(Boolean)
        .join(' · '),
      photos: e.photos,
      eventId: e.id,
    });
  }
  for (const line of series.values()) {
    items.push({
      ...line,
      subtitle: `${line.count === 1 ? '1 volta' : `${line.count} volte`} a ${monthLabel(new Date(line.at))}`,
    });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export default function GroupHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAsync(async () => {
    const [group, history, level] = await Promise.all([api.getGroupById(id), api.getGroupHistory(id), api.getGroupLevel(id)]);
    return group && history ? { group, history, level } : null;
  }, [id]);

  if (!data.data) {
    return (
      <Screen width="page">
        <Header title="La nostra storia" />
        {data.data === null ? (
          <Text className="p-4 text-stone-600">Questo gruppo non esiste più o non puoi vederlo.</Text>
        ) : (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        )}
      </Screen>
    );
  }

  const { group, history, level } = data.data;
  const clan = clanOf(group);
  const cards = legendCards(history, level);
  const items = timeline(history, group.name);
  const events = history.events.filter((e) => e.kind === 'event').length;
  const trips = history.events.filter((e) => e.kind === 'trip').length;
  const photos = history.events.reduce((sum, e) => sum + e.photos.length, 0);
  const stats = [
    `${events} ${events === 1 ? 'evento' : 'eventi'}`,
    trips ? `${trips} ${trips === 1 ? 'vacanza' : 'vacanze'}` : null,
    photos ? `${photos} foto` : null,
    `${history.members.length + 1} membri`,
  ].filter(Boolean);

  return (
    <GroupTheme group={group}>
      <Screen width="page">
        <Header title="La nostra storia" subtitle={group.name} />
        <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-2 wide:px-8">
          <View className="flex-row items-center gap-4 rounded-3xl bg-brand-200 p-4">
            <ClanEmblem element={clan.element} rings={stageFor(level.xp).level} size={56} />
            <View className="flex-1 gap-0.5">
              <Text className="text-xs text-brand-800">{clan.name} · dal {formatDate(history.created_at)}</Text>
              <Text className="text-lg font-semibold text-brand-800">{stats.join(' · ')}</Text>
            </View>
          </View>

          <LegendCards cards={cards} />

          <View>
            {items.map((item) => (
              <TimelineRow key={item.key} item={item} />
            ))}
            <View className="flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                <Text>📍</Text>
              </View>
              <View className="flex-1 justify-center">
                <Text className="font-semibold text-ink">Oggi</Text>
                <Text className="text-sm text-stone-500">E la storia continua…</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Screen>
    </GroupTheme>
  );
}

const RARITY_STYLE: Record<Rarity, { box: string; label: string }> = {
  comune: { box: 'bg-stone-100', label: 'text-stone-500' },
  rara: { box: 'bg-sky-100', label: 'text-sky-700' },
  epica: { box: 'bg-violet-100', label: 'text-violet-700' },
  leggendaria: { box: 'bg-amber-100', label: 'text-amber-700' },
};

// Collectible cards of the group's special moments; locked ones are a "?" with the hint
function LegendCards({ cards }: { cards: LegendCard[] }) {
  const unlocked = cards.filter((c) => c.unlockedAt).length;
  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-ink">
        Carte leggendarie {unlocked}/{cards.length}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1">
        {cards.map((card) => {
          const style = RARITY_STYLE[card.rarity];
          return card.unlockedAt ? (
            <View key={card.id} className={`h-40 w-28 items-center justify-between rounded-2xl p-3 ${style.box}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${style.label}`}>
                {card.rarity}
                {card.rarity === 'leggendaria' ? ' ✨' : ''}
              </Text>
              <Text className="text-4xl">{card.emoji}</Text>
              <View className="items-center">
                <Text className="text-center text-xs font-semibold text-ink">{card.title}</Text>
                <Text className="text-[10px] text-stone-500">{formatDate(card.unlockedAt)}</Text>
              </View>
            </View>
          ) : (
            <View key={card.id} className="h-40 w-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 p-3">
              <Text className="text-3xl text-stone-300">?</Text>
              <Text className="text-center text-[10px] text-stone-400">{card.hint}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimelineRow({ item }: { item: Item }) {
  const content = (
    <View className="mb-4 flex-1 gap-1 rounded-3xl bg-white p-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-stone-400">{formatDate(item.at)}</Text>
      <Text className="text-base font-semibold text-ink">{item.title}</Text>
      {item.subtitle ? <Text className="text-sm text-stone-500">{item.subtitle}</Text> : null}
      {item.photos?.length ? (
        <View className="mt-1 flex-row gap-1.5">
          {item.photos.slice(0, 4).map((url) => (
            <Image key={url} source={{ uri: url }} className="h-16 w-16 rounded-xl bg-stone-200" resizeMode="cover" />
          ))}
          {item.photos.length > 4 ? (
            <View className="h-16 w-16 items-center justify-center rounded-xl bg-stone-100">
              <Text className="font-semibold text-stone-600">+{item.photos.length - 4}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-row gap-4">
      {/* The line of the timeline, with the emoji on it */}
      <View className="w-10 items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <Text className="text-lg">{item.emoji}</Text>
        </View>
        <View className="w-0.5 flex-1 bg-stone-200" />
      </View>
      {item.eventId ? (
        <Pressable
          className="flex-1"
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.eventId! } })}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}
