// Gruppi tab: the groups in town, filterable, plus the bell for Attività (notifications).
// Reloads when the tab gains focus.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { RelocatedBadge } from '../../../components/Badge';
import { Chip } from '../../../components/Chip';
import { GroupCard } from '../../../components/GroupCard';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';
import { firstName } from '../../../lib/format';

type Filter = 'all' | 'open' | 'mine';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'open', label: 'Aperti a nuovi membri' },
  { value: 'mine', label: 'I miei' },
];

export default function GroupsScreen() {
  const user = useAuth((state) => state.user)!; // guaranteed by the route guard
  const [filter, setFilter] = useState<Filter>('all');

  const feed = useAsync(
    async () => {
      const [groups, memberships] = await Promise.all([api.getGroups(), api.getMemberships(user.id)]);
      // Open groups first
      groups.sort((a, b) => (a.type === b.type ? 0 : a.type === 'open_to_new' ? -1 : 1));
      return { groups, myGroupIds: new Set(memberships.map((m) => m.group.id)) };
    },
    [user.id],
    { refetchOnFocus: true },
  );

  const unread = useAsync(() => api.getUnreadNotificationCount(user.id), [user.id], { refetchOnFocus: true });

  const visibleGroups = (feed.data?.groups ?? []).filter((group) => {
    if (filter === 'open') return group.type === 'open_to_new';
    if (filter === 'mine') return feed.data?.myGroupIds.has(group.id);
    return true;
  });

  const subtitle =
    user.role === 'group'
      ? 'Scopri chi c’è in giro e cosa fanno gli altri gruppi.'
      : 'Questi gruppi cercano gente nuova. Trova il tuo.';

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-3xl font-bold text-ink">Ciao, {firstName(user.full_name)} 👋</Text>
            {user.is_relocated ? <RelocatedBadge /> : null}
            <Text className="text-base text-stone-600">{subtitle}</Text>
          </View>
          <BellButton unread={unread.data ?? 0} />
        </View>

        <View className="flex-row flex-wrap gap-2">
          {filters.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </View>

        {!feed.data && feed.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : feed.error ? (
          <Text className="text-red-600">{feed.error}</Text>
        ) : visibleGroups.length === 0 ? (
          <Text className="mt-6 text-center text-stone-500">
            {filter === 'mine' ? 'Non fai ancora parte di nessun gruppo.' : 'Nessun gruppo trovato.'}
          </Text>
        ) : (
          <View className="gap-3">
            {visibleGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// Opens Attività; the red badge shows unread notifications
function BellButton({ unread }: { unread: number }) {
  return (
    <Link href="/activity" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Attività, ${unread} non lette` : 'Attività'}
        className="h-11 w-11 items-center justify-center rounded-full bg-white active:bg-stone-200"
      >
        <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.ink} />
        {unread > 0 ? (
          <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
            <Text className="text-xs font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}
