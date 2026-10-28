// Group card for the home feed and the search: badges for members, newcomers, privacy, ages,
// venue pages, reliability (from the members' points) and the distance when known

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ageRangeLabel } from '../lib/search';
import type { GroupSummary } from '../lib/types';
import { Badge } from './Badge';
import { GroupIcon, groupIconOf } from './GroupIcon';
import { ReliabilityBadge } from './ReliabilityBadge';

export function GroupCard({ group, reliability, distance }: { group: GroupSummary; reliability?: number; distance?: string }) {
  const isOpen = group.type === 'open_to_new';
  const ages = ageRangeLabel(group.age_min, group.age_max);

  return (
    <Link href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
      <Pressable className="rounded-3xl bg-white p-4 active:bg-stone-100">
        <View className="flex-row gap-3">
          <GroupIcon {...groupIconOf(group)} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink">{group.name}</Text>
            {group.location ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Ionicons name="location-outline" size={13} className="text-stone-500" />
                <Text className="text-sm text-stone-500">
                  {group.location}
                  {distance ? ` · ${distance}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {group.description ? (
          <Text numberOfLines={2} className="mt-3 text-sm leading-5 text-stone-600">
            {group.description}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {group.is_business ? <Badge label="Locale" tone="sky" icon="storefront" /> : null}
          <Badge label={group.member_count === 1 ? '1 membro' : `${group.member_count} membri`} icon="people" />
          {ages ? <Badge label={ages} icon="person" /> : null}
          <ReliabilityBadge points={reliability} />
          {group.relocated_count > 0 ? (
            <Badge label={`${group.relocated_count} da poco in città`} tone="sky" icon="airplane" />
          ) : null}
          {group.visibility === 'private' ? <Badge label="Privato" icon="lock-closed" /> : null}
          {isOpen ? (
            <Badge label="Aperto" tone="green" icon="checkmark-circle" />
          ) : (
            <Badge label="Al completo" icon="lock-closed" />
          )}
        </View>
      </Pressable>
    </Link>
  );
}
