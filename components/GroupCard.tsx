// Group card for the home feed

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { GroupSummary } from '../lib/types';
import { Badge } from './Badge';
import { GroupIcon } from './GroupIcon';
import { colors } from './theme';

export function GroupCard({ group }: { group: GroupSummary }) {
  const isOpen = group.type === 'open_to_new';

  return (
    <Link href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
      <Pressable className="rounded-3xl border border-stone-200 bg-white p-4 active:bg-stone-100">
        <View className="flex-row gap-3">
          <GroupIcon name={group.name} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink">{group.name}</Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <Ionicons name="location-outline" size={13} color={colors.muted} />
              <Text className="text-sm text-stone-500">{group.location}</Text>
            </View>
          </View>
        </View>

        <Text numberOfLines={2} className="mt-3 text-sm leading-5 text-stone-600">
          {group.description}
        </Text>

        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Badge label={`${group.member_count} membri`} icon="people" />
          {group.relocated_count > 0 ? (
            <Badge label={`${group.relocated_count} da poco in città`} tone="sky" icon="airplane" />
          ) : null}
          {isOpen ? (
            <Badge label="Aperto a nuovi membri" tone="green" icon="checkmark-circle" />
          ) : (
            <Badge label="Al completo" icon="lock-closed" />
          )}
        </View>
      </Pressable>
    </Link>
  );
}
