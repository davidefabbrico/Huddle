// Upcoming event row: date tile + title, group, time and place.
// `showGroup` adds the group name (home feed); tapping opens the group.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { dateTile, formatEventDate } from '../lib/format';
import type { EventWithGroup } from '../lib/types';
import { colors } from './theme';

export function EventCard({ event, showGroup = false }: { event: EventWithGroup; showGroup?: boolean }) {
  const tile = dateTile(event.date_time);

  return (
    <Link href={{ pathname: '/group/[id]', params: { id: event.group_id } }} asChild>
      <Pressable className="flex-row gap-3 rounded-3xl border border-stone-200 bg-white p-3 active:bg-stone-100">
        <View className="w-14 items-center justify-center rounded-2xl bg-brand-50 py-2">
          <Text className="text-xl font-bold text-brand-600">{tile.day}</Text>
          <Text className="text-xs font-semibold text-brand-600">{tile.month}</Text>
        </View>
        <View className="flex-1 justify-center">
          <Text numberOfLines={1} className="text-base font-semibold text-ink">
            {event.title}
          </Text>
          {showGroup ? (
            <Text numberOfLines={1} className="text-sm font-medium text-brand-600">
              {event.group_name}
            </Text>
          ) : null}
          <View className="mt-0.5 flex-row items-center gap-1">
            <Ionicons name="time-outline" size={13} color={colors.muted} />
            <Text className="text-sm text-stone-500">{formatEventDate(event.date_time)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text numberOfLines={1} className="flex-1 text-sm text-stone-500">
              {event.location}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
