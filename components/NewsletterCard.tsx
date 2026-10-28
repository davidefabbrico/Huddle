// "📰 La tua settimana" at the top of "Per te": the weekly newsletter (lib/recommendations.ts,
// weeklyPicks). Turned off in Modifica profilo, like the weekly notification in Attività.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { formatEventDate, tripDatesLabel } from '../lib/format';
import type { WeeklyPick } from '../lib/recommendations';

export function NewsletterCard({ picks, hasArea }: { picks: WeeklyPick[]; hasArea: boolean }) {
  return (
    <View className="gap-2 rounded-3xl bg-brand-50 p-4">
      <Text className="text-base font-bold text-ink">📰 La tua settimana</Text>
      {picks.length === 0 ? (
        <Text className="text-sm text-stone-600">
          Niente in vista questa settimana.{hasArea ? '' : ' Imposta la tua zona nel profilo per vedere anche gli eventi vicini.'}
        </Text>
      ) : (
        picks.map(({ event, why }) => (
          <Link key={event.id} href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
            <Pressable className="flex-row items-center gap-3 rounded-2xl bg-white px-3 py-2.5 active:bg-stone-100">
              <View className="flex-1">
                <Text numberOfLines={1} className="font-semibold text-ink">
                  {event.title}
                </Text>
                <Text numberOfLines={1} className="text-xs text-stone-500">
                  {event.kind === 'trip' ? tripDatesLabel(event.date_time, event.ends_at) : formatEventDate(event.date_time)} · {why}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} className="text-stone-500" />
            </Pressable>
          </Link>
        ))
      )}
    </View>
  );
}
