// Profilo tab: who you are, your stats, achievements, your rank in each group and the full rank ladder

import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { GroupIcon } from '../../../components/GroupIcon';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import { computeAchievements, type Achievement } from '../../../lib/achievements';
import * as api from '../../../lib/api';
import { arrivalLabel, intentLabels, roleLabels } from '../../../lib/format';
import { nextRank, rankFor, rankProgress, RANKS } from '../../../lib/ranks';
import type { Membership } from '../../../lib/types';

export default function ProfileScreen() {
  const user = useAuth((state) => state.user)!;
  const signOut = useAuth((state) => state.signOut);
  const stats = useAsync(() => api.getProfileStats(user.id), [user.id], { refetchOnFocus: true });

  const list = stats.data?.memberships ?? [];
  const achievements = stats.data ? computeAchievements(stats.data) : [];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalEvents = list.reduce((sum, m) => sum + m.attended_events, 0);
  const bestRank = rankFor(Math.max(0, ...list.map((m) => m.attended_events)));

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-4">
        {/* Identity */}
        <View className="items-center gap-2">
          <Avatar {...avatarOf(user)} size={88} />
          <Text className="text-center text-2xl font-bold text-ink">{user.full_name}</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {user.is_relocated ? <RelocatedBadge /> : null}
            <Badge label={roleLabels[user.role]} tone="brand" icon={user.role === 'group' ? 'people' : 'person'} />
          </View>
          {user.is_relocated && user.relocated_at ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={14} color={colors.muted} />
              <Text className="text-sm text-stone-500">{arrivalLabel(user.relocated_at)}</Text>
            </View>
          ) : null}
          {user.bio ? <Text className="text-center text-base leading-6 text-stone-600">{user.bio}</Text> : null}
          <Button title="Modifica profilo" icon="create-outline" variant="secondary" size="sm" onPress={() => router.push('/edit-profile')} />
        </View>

        {/* Stats */}
        <View className="flex-row gap-3">
          <Stat value={String(list.length)} label="Gruppi" />
          <Stat value={String(totalEvents)} label="Eventi frequentati" />
          <Stat value={list.length ? bestRank.emoji : '—'} label={list.length ? bestRank.name : 'Nessun grado'} />
        </View>

        {/* What you're looking for */}
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-sm font-semibold text-stone-500">COSA CERCO</Text>
          <View className="flex-row">
            <Chip label={intentLabels[user.intent]} selected />
          </View>
          {user.interests.length > 0 ? (
            <>
              <Text className="mt-1 text-sm font-semibold text-stone-500">INTERESSI</Text>
              <View className="flex-row flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <Chip key={interest} label={interest} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* Achievements */}
        {stats.data ? (
          <View className="gap-3">
            <Text className="text-lg font-semibold text-ink">
              Traguardi ({unlockedCount}/{achievements.length})
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {achievements.map((achievement) => (
                <AchievementTile key={achievement.id} achievement={achievement} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Rank in each group */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">Il tuo grado nei gruppi</Text>
          {!stats.data && stats.loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : list.length === 0 ? (
            <View className="items-center gap-3 rounded-3xl border border-dashed border-stone-300 p-6">
              <Text className="text-center text-stone-500">
                Entra in un gruppo e partecipa agli eventi per salire di grado: da Turista per caso a Leggenda vivente.
              </Text>
              <Button title="Trova un gruppo" icon="people" variant="secondary" onPress={() => router.navigate('/')} />
            </View>
          ) : (
            list.map((membership) => <RankCard key={membership.group.id} membership={membership} />)
          )}
        </View>

        {/* The ladder */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">La scala dei gradi</Text>
          <Text className="text-sm text-stone-500">Ogni evento a cui partecipi in un gruppo ti fa salire di grado in quel gruppo.</Text>
          <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            {RANKS.map((rank, index) => {
              const reached = list.length > 0 && bestRank.level >= rank.level;
              return (
                <View key={rank.level} className={`flex-row items-center gap-3 p-4 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
                  <Text className={`text-2xl ${reached ? '' : 'opacity-40'}`}>{rank.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold ${reached ? 'text-ink' : 'text-stone-400'}`}>
                      {rank.level}. {rank.name}
                    </Text>
                    <Text className="text-sm text-stone-500">{rank.description}</Text>
                  </View>
                  <Text className="text-xs text-stone-400">
                    {rank.minEvents === 0 ? 'all’ingresso' : `${rank.minEvents}+ eventi`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Button title="Esci" icon="log-out-outline" variant="secondary" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-1 rounded-3xl bg-white px-2 py-4">
      <Text className="text-2xl font-bold text-ink">{value}</Text>
      <Text numberOfLines={2} className="text-center text-xs text-stone-500">
        {label}
      </Text>
    </View>
  );
}

// One achievement badge; locked ones are faded and show how to unlock them
function AchievementTile({ achievement }: { achievement: Achievement }) {
  return (
    <View
      className={`w-[31%] flex-grow items-center gap-1 rounded-3xl p-3 ${achievement.unlocked ? 'bg-white' : 'border border-dashed border-stone-300'}`}
    >
      <Text className={`text-3xl ${achievement.unlocked ? '' : 'opacity-30'}`}>{achievement.emoji}</Text>
      <Text className={`text-center text-sm font-semibold ${achievement.unlocked ? 'text-ink' : 'text-stone-400'}`}>
        {achievement.name}
      </Text>
      <Text className="text-center text-xs text-stone-500">{achievement.description}</Text>
    </View>
  );
}

// Your rank in one group, with progress toward the next rank
function RankCard({ membership }: { membership: Membership }) {
  const { group, member_role, attended_events } = membership;
  const rank = rankFor(attended_events);
  const next = nextRank(attended_events);
  const progress = rankProgress(attended_events);

  return (
    <Link href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
      <Pressable className="gap-3 rounded-3xl border border-stone-200 bg-white p-4 active:bg-stone-100">
        <View className="flex-row items-center gap-3">
          <GroupIcon name={group.name} size={40} />
          <View className="flex-1">
            <Text numberOfLines={1} className="font-semibold text-ink">
              {group.name}
            </Text>
            <Text className="text-sm text-stone-500">
              {attended_events === 1 ? '1 evento' : `${attended_events} eventi`}
            </Text>
          </View>
          {member_role === 'admin' ? <Badge label="Admin" tone="brand" icon="star" /> : null}
        </View>

        <View className="flex-row items-center gap-3 rounded-2xl bg-brand-50 p-3">
          <Text className="text-3xl">{rank.emoji}</Text>
          <View className="flex-1 gap-1.5">
            <Text className="font-bold text-brand-700">{rank.name}</Text>
            <View className="h-2 overflow-hidden rounded-full bg-brand-100">
              <View className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(progress * 100)}%` }} />
            </View>
            <Text className="text-xs text-stone-500">
              {next
                ? `Ancora ${next.missing === 1 ? '1 evento' : `${next.missing} eventi`} per diventare ${next.rank.name} ${next.rank.emoji}`
                : 'Grado massimo raggiunto!'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
