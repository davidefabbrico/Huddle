// Someone else's profile (tap a name or a photo): photo, bio, badges, where they work, their reliability
// (pixel stars), their best rank, their interests (the ones you share stand out) and the achievements they
// unlocked. Only what public_profile gives: never their age, area, email or which events they went to.
// Your own name leads to your Profilo; "⋯": block or report.

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { Badge, RelocatedBadge } from '../../../components/Badge';
import { GroupIcon, groupIconOf } from '../../../components/GroupIcon';
import { Header } from '../../../components/Header';
import { InterestChips } from '../../../components/InterestPicker';
import { PixelStars } from '../../../components/ReliabilityBadge';
import { PersonMenuButton } from '../../../components/SafetyActions';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import { computeAchievements } from '../../../lib/achievements';
import * as api from '../../../lib/api';
import { arrivalLabel } from '../../../lib/format';
import { rankFor } from '../../../lib/ranks';
import { reliabilityFor } from '../../../lib/reliability';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((state) => state.user)!;
  const data = useAsync(async () => {
    const [profile, venues] = await Promise.all([api.getPublicProfile(id), api.getStaffVenues(id)]);
    return profile ? { profile, venues } : null;
  }, [id]);

  if (id === me.id) return <Redirect href="/profile" />;

  if (!data.data) {
    return (
      <Screen width="page">
        <Header title="Profilo" />
        {data.data === null ? (
          <Text className="p-4 text-stone-600">Questo profilo non è disponibile.</Text>
        ) : (
          <ActivityIndicator color={colors.brand} className="mt-10" />
        )}
      </Screen>
    );
  }

  const { profile, venues } = data.data;
  const isBusiness = profile.account_type === 'business';
  const reliability = reliabilityFor(profile.points);
  const rank = rankFor(profile.best_group_events);
  const shared = new Set(me.interests.filter((key) => profile.interests.includes(key)));
  const achievements = computeAchievements(profile.facts).filter((a) => a.unlocked);

  return (
    <Screen width="page">
      <Header title={profile.full_name} right={<PersonMenuButton me={me.id} person={profile} onBlocked={data.reload} />} />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-2 wide:px-8">
        {/* Who */}
        <View className="items-center gap-2">
          <Avatar {...avatarOf(profile)} size={88} />
          <Text className="text-center text-2xl font-bold text-ink">{profile.full_name}</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {isBusiness ? <Badge label="Locale o azienda" tone="sky" icon="storefront" /> : null}
            {profile.is_relocated ? <RelocatedBadge /> : null}
          </View>
          {profile.is_relocated && profile.relocated_at ? <Text className="text-sm text-stone-500">{arrivalLabel(profile.relocated_at)}</Text> : null}
          {profile.bio ? <Text className="text-center text-base leading-6 text-stone-600">{profile.bio}</Text> : null}
        </View>

        {/* Where they work */}
        {venues.length ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-stone-500">LAVORA A</Text>
            {venues.map((venue) => (
              <Link key={venue.id} href={{ pathname: '/group/[id]', params: { id: venue.id } }} asChild>
                <Pressable className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 active:bg-stone-100">
                  <GroupIcon {...groupIconOf(venue)} size={36} />
                  <Text className="flex-1 font-semibold text-ink">{venue.name}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : null}

        {/* Reliability and best rank */}
        {isBusiness ? null : (
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1 rounded-3xl bg-brand-50 p-4">
              <Text className="text-xs font-semibold text-brand-700">AFFIDABILITÀ</Text>
              <PixelStars stars={reliability.stars} size={16} />
              <Text className="text-base font-bold text-ink">{reliability.label}</Text>
            </View>
            <View className="flex-1 gap-1 rounded-3xl bg-brand-50 p-4">
              <Text className="text-xs font-semibold text-brand-700">GRADO PIÙ ALTO</Text>
              <Text className="text-2xl">{rank.emoji}</Text>
              <Text className="text-base font-bold text-ink">{rank.name}</Text>
            </View>
          </View>
        )}

        {/* Interests */}
        {profile.interests.length ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-stone-500">
              INTERESSI{shared.size ? ` · ${shared.size} in comune con te` : ''}
            </Text>
            <InterestChips keys={profile.interests} shared={shared} />
          </View>
        ) : null}

        {/* Achievements */}
        {achievements.length ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-stone-500">TRAGUARDI ({achievements.length})</Text>
            <View className="flex-row flex-wrap gap-2">
              {achievements.map((a) => (
                <View key={a.id} className="flex-row items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                  <Text className="text-xl">{a.emoji}</Text>
                  <Text className="text-sm font-semibold text-ink">{a.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
