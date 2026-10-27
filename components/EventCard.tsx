// Upcoming event row: date tile + title, group, time and place.
// `showGroup` adds the group name; tapping opens the event. Badges: live, recurring, poster, and your answer.
// In "Per te": `reason` says why it's suggested, `outside` marks the "Fuori dal solito" slot.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { eventPhase } from '../lib/eventTiming';
import { dateTile, formatEventDate, tripDatesLabel, weekdaysLabel } from '../lib/format';
import type { EventAttendee, EventWithGroup } from '../lib/types';
import { Badge } from './Badge';
import { colors } from './theme';

interface Props {
  event: EventWithGroup;
  showGroup?: boolean;
  answer?: EventAttendee; // your "Ci sono" / "Non ci sono"
  reason?: string;
  outside?: boolean;
}

export function EventCard({ event, showGroup = false, answer, reason, outside = false }: Props) {
  const tile = dateTile(event.date_time);

  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable className="flex-row gap-3 rounded-3xl border border-stone-200 bg-white p-3 active:bg-stone-100">
        <View className="w-14 items-center justify-center rounded-2xl bg-brand-50 py-2">
          <Text className="text-xl font-bold text-brand-600">{tile.day}</Text>
          <Text className="text-xs font-semibold text-brand-600">{tile.month}</Text>
        </View>
        <View className="flex-1 justify-center">
          <View className="flex-row flex-wrap gap-1">
            {outside ? <Badge label="Fuori dal solito" tone="sky" icon="compass" /> : null}
            {event.kind === 'trip' ? <Badge label="Vacanza" tone="sky" icon="airplane" /> : null}
            {event.group_is_business ? <Badge label="Locale" tone="sky" icon="storefront" /> : null}
            {event.cancelled_at ? <Badge label="Annullato" icon="close-circle" /> : null}
            {event.visibility === 'private' ? <Badge label="Solo gruppo" icon="lock-closed" /> : null}
            {eventPhase(event.date_time, event.ends_at) === 'live' ? <Badge label="In corso" tone="green" icon="radio-button-on" /> : null}
            {event.series ? <Badge label={weekdaysLabel(event.series.weekdays)} icon="repeat" /> : null}
            {answer?.status === 'going' ? <Badge label="Ci sei" tone="green" icon="checkmark" /> : null}
            {answer?.status === 'not_going' ? <Badge label="Non ci sei" icon="close" /> : null}
            {event.poster_url ? <Badge label="Locandina" tone="brand" icon="attach" /> : null}
          </View>
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
            <Text className="text-sm text-stone-500">
              {event.kind === 'trip' ? tripDatesLabel(event.date_time, event.ends_at) : formatEventDate(event.date_time)}
            </Text>
          </View>
          {event.location ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={13} color={colors.muted} />
              <Text numberOfLines={1} className="flex-1 text-sm text-stone-500">
                {event.location}
              </Text>
            </View>
          ) : null}
          {reason ? (
            <Text numberOfLines={2} className="mt-1 text-sm font-medium text-brand-700">
              ✨ {reason}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
