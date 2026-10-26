// Home feed: upcoming events and local groups. Reloads when the screen regains focus.

import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { RelocatedBadge } from '../../components/Badge';
import { EventCard } from '../../components/EventCard';
import { GroupCard } from '../../components/GroupCard';
import { Screen } from '../../components/Screen';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { firstName } from '../../lib/format';

export default function HomeScreen() {
  const user = useAuth((state) => state.user)!; // guaranteed by the route guard
  const signOut = useAuth((state) => state.signOut);

  const feed = useAsync(async () => {
    const [groups, events] = await Promise.all([api.getGroups(), api.getUpcomingEvents(8)]);
    // Open groups first
    groups.sort((a, b) => (a.type === b.type ? 0 : a.type === 'open_to_new' ? -1 : 1));
    return { groups, events };
  }, []);

  const { reload } = feed;
  useFocusEffect(useCallback(() => reload(), [reload]));

  const subtitle =
    user.role === 'group'
      ? 'Scopri chi c’è in giro e cosa fanno gli altri gruppi.'
      : 'Questi gruppi cercano gente nuova. Trova il tuo.';

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-3xl font-bold text-ink">Ciao, {firstName(user.full_name)} 👋</Text>
            {user.is_relocated ? <RelocatedBadge /> : null}
            <Text className="text-base text-stone-600">{subtitle}</Text>
          </View>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Esci"
            className="h-10 w-10 items-center justify-center rounded-full bg-white active:bg-stone-200"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {!feed.data && feed.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        ) : feed.error ? (
          <Text className="text-red-600">{feed.error}</Text>
        ) : feed.data ? (
          <>
            <View className="gap-3">
              <Text className="text-lg font-semibold text-ink">Prossimi eventi</Text>
              {feed.data.events.length === 0 ? (
                <Text className="text-stone-500">Nessun evento in programma.</Text>
              ) : (
                feed.data.events.map((event) => <EventCard key={event.id} event={event} showGroup />)
              )}
            </View>

            <View className="gap-3">
              <Text className="text-lg font-semibold text-ink">Gruppi a Milano</Text>
              {feed.data.groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
