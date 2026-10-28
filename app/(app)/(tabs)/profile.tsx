// Profilo tab: who you are, points, achievements, your rank in each group, the rank ladder and your account.
// Two columns on a computer.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { Columns } from '../../../components/Columns';
import { Confetti } from '../../../components/Confetti';
import { InfoTip } from '../../../components/InfoTip';
import { GroupIcon, groupIconOf } from '../../../components/GroupIcon';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import { useThemePreference } from '../../../hooks/useThemeMode';
import { computeAchievements, newAchievements, type Achievement } from '../../../lib/achievements';
import * as api from '../../../lib/api';
import { arrivalLabel, intentLabels, roleLabels } from '../../../lib/format';
import { businessPointsRules, pointsRules, PROMOTION_COST } from '../../../lib/points';
import { RELIABILITY, reliabilityFor, starsLabel } from '../../../lib/reliability';
import { nextRank, rankFor, rankProgress, RANKS } from '../../../lib/ranks';
import type { Membership } from '../../../lib/types';

export default function ProfileScreen() {
  const user = useAuth((state) => state.user)!;
  const signOut = useAuth((state) => state.signOut);
  // Achievements unlocked since the last visit get a little party (confetti + banner)
  const stats = useAsync(
    async () => {
      const result = await api.getProfileStats(user.id);
      return { ...result, fresh: newAchievements(computeAchievements(result)), loadedAt: Date.now() };
    },
    [user.id],
    { refetchOnFocus: true },
  );
  // Points as the database counts them (per account type), and what a venue spent on promotions
  const myPoints = useAsync(() => api.getMyPoints(), [user.id], { refetchOnFocus: true });
  const isBusiness = user.account_type === 'business';
  const earned = myPoints.data?.earned;
  const reliability = earned !== undefined ? reliabilityFor(earned) : null;
  const nextReliability = reliability ? RELIABILITY.find((level) => level.stars === reliability.stars + 1) : undefined;
  const email = useAsync(() => api.getCurrentEmail(), []);

  const list = stats.data?.memberships ?? [];
  // Secret achievements stay out of sight (not even counted) until you unlock one
  const achievements = stats.data ? computeAchievements(stats.data).filter((a) => !a.secret || a.unlocked) : [];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const bestRank = rankFor(Math.max(0, ...list.map((m) => m.attended_events)));

  const fresh = stats.data?.fresh ?? [];
  const [showRules, setShowRules] = useState(false);
  const themePreference = useThemePreference((state) => state.preference);
  const setThemePreference = useThemePreference((state) => state.setPreference);

  return (
    <Screen width="wide">
      <Confetti burst={fresh.length ? (stats.data?.loadedAt ?? 0) : 0} />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-4 wide:px-8 wide:pt-8">
        {fresh.length ? (
          <View className="flex-row items-center gap-3 rounded-3xl bg-amber-100 p-4">
            <Text className="text-3xl">{fresh[0].emoji}</Text>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-amber-700">
                {fresh[0].secret ? 'Traguardo segreto sbloccato!' : 'Traguardo sbloccato!'}
              </Text>
              <Text className="text-base font-semibold text-amber-900">
                {fresh.map((a) => a.name).join(', ')}
              </Text>
            </View>
          </View>
        ) : null}
        <Columns
          main={
            <>
              {/* Identity */}
              <View className="items-center gap-2">
                <Avatar {...avatarOf(user)} size={88} />
                <Text className="text-center text-2xl font-bold text-ink">{user.full_name}</Text>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {user.is_relocated ? <RelocatedBadge /> : null}
                  {isBusiness ? (
                  <Badge label="Locale o azienda" tone="sky" icon="storefront" />
                ) : (
                  <Badge label={roleLabels[user.role]} tone="brand" icon={user.role === 'group' ? 'people' : 'person'} />
                )}
                </View>
                {user.is_relocated && user.relocated_at ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="calendar-outline" size={14} className="text-stone-500" />
                    <Text className="text-sm text-stone-500">{arrivalLabel(user.relocated_at)}</Text>
                  </View>
                ) : null}
                {user.bio ? <Text className="text-center text-base leading-6 text-stone-600">{user.bio}</Text> : null}
                <Button title="Modifica profilo" icon="create-outline" variant="secondary" size="sm" onPress={() => router.push('/edit-profile')} />
              </View>

              {/* Stats */}
              <View className="flex-row gap-3">
                <Stat
                  value={String(earned === undefined ? '–' : isBusiness ? earned - (myPoints.data?.spent ?? 0) : earned)}
                  label={isBusiness ? 'Punti da spendere' : 'Punti'}
                  highlight
                />
                <Stat value={String(stats.data?.attended ?? '–')} label="Eventi frequentati" />
                <Stat value={String(stats.data?.thanks_received ?? '–')} label="Grazie ricevuti 🙏" />
              </View>
              {list.length ? (
                <Text className="-mt-3 text-center text-sm text-stone-500">
                  Grado più alto: {bestRank.emoji} {bestRank.name}
                </Text>
              ) : null}

              {/* Reliability: what the points mean */}
              {reliability ? (
                <View className="gap-1 rounded-3xl bg-brand-50 p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-brand-700">LA TUA AFFIDABILITÀ</Text>
                    <InfoTip
                      text={
                        nextReliability
                          ? `Con ${nextReliability.minPoints} punti diventi “${nextReliability.label}” (ne hai ${earned}). La vedono gli altri sul tuo profilo e nei gruppi.`
                          : 'Livello massimo: la vedono gli altri sul tuo profilo e nei gruppi.'
                      }
                    />
                  </View>
                  <Text className="text-xl font-bold text-ink">
                    {starsLabel(reliability.stars)} {reliability.label}
                  </Text>
                  <Text className="text-sm text-stone-600">{reliability.description}</Text>
                </View>
              ) : null}

              {/* How points work (opens on tap) */}
              <View className="gap-2 rounded-3xl bg-white p-4">
                <Pressable onPress={() => setShowRules(!showRules)} accessibilityRole="button" className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-stone-500">COME SI GUADAGNANO I PUNTI</Text>
                  <Ionicons name={showRules ? 'chevron-up' : 'chevron-down'} size={18} className="text-stone-500" />
                </Pressable>
                {!showRules ? null : isBusiness ? (
                  <Text className="text-sm text-stone-500">
                    Per i locali contano le persone che vengono. Con {PROMOTION_COST} punti mandi un tuo evento ai gruppi della zona.
                  </Text>
                ) : null}
                {(showRules ? (isBusiness ? businessPointsRules : pointsRules) : []).map((rule) => (
                  <View key={rule.label} className="flex-row items-center gap-3">
                    <Text className="text-lg">{rule.emoji}</Text>
                    <Text className="flex-1 text-base text-stone-700">{rule.label}</Text>
                    <Text className="font-bold text-brand-600">+{rule.points}</Text>
                  </View>
                ))}
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
            </>
          }
          side={
            <>
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
                      Entra in un gruppo e partecipa agli eventi per salire di grado: da Volto nuovo a Leggenda vivente.
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
                <View className="overflow-hidden rounded-3xl bg-white">
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

              {/* Account */}
              <View className="gap-3 rounded-3xl bg-white p-4">
                <Text className="text-sm font-semibold text-stone-500">ACCOUNT</Text>
                {email.data ? <Text className="text-base text-stone-700">{email.data}</Text> : null}
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="mr-1 text-base text-stone-700">Tema</Text>
                  {(
                    [
                      ['light', '☀️ Chiaro'],
                      ['dark', '🌙 Notte'],
                      ['system', '📱 Automatico'],
                    ] as const
                  ).map(([value, label]) => (
                    <Chip key={value} label={label} selected={themePreference === value} onPress={() => setThemePreference(value)} />
                  ))}
                </View>
                <Button title="Cambia password" icon="key-outline" variant="secondary" onPress={() => router.push('/change-password')} />
                <Button title="Esci" icon="log-out-outline" variant="muted" onPress={signOut} />
              <ConfirmButton
                title="Elimina il mio account"
                confirmTitle="Sì, elimina tutto"
                icon="trash-outline"
                warning="Per sempre: profilo, risposte, messaggi, foto, punti e impostazioni. I gruppi di cui sei admin passano al membro entrato per primo (quelli senza altri membri vengono eliminati)."
                onConfirm={() => api.deleteMyAccount(user.id)}
              />
              </View>
            </>
          }
        />
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label, highlight = false }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View className={`flex-1 items-center justify-center gap-1 rounded-3xl px-2 py-4 ${highlight ? 'bg-brand-200' : 'bg-white'}`}>
      <Text className={`text-2xl font-bold ${highlight ? 'text-brand-800' : 'text-ink'}`}>{value}</Text>
      <Text numberOfLines={2} className={`text-center text-xs ${highlight ? 'text-brand-800' : 'text-stone-500'}`}>
        {label}
      </Text>
    </View>
  );
}

// One achievement badge; locked ones are faded and show how to unlock them (secret ones aren't shown)
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
      <Pressable className="gap-3 rounded-3xl bg-white p-4 active:bg-stone-100">
        <View className="flex-row items-center gap-3">
          <GroupIcon {...groupIconOf(group)} size={40} />
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
              <View className="h-full rounded-full bg-brand-400" style={{ width: `${Math.round(progress * 100)}%` }} />
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
