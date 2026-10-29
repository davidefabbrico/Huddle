// "Lo staff" on a venue's page: the people who run it (tap: their profile). A person who works there
// taps "Lavoro qui"; the venue approves (or refuses) the requests here. The staff can organize events
// for the venue (can_organize in the database) and the venue shows on their profile.

import { View } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import * as api from '../lib/api';
import type { User } from '../lib/types';
import { Avatar, avatarOf } from './Avatar';
import { Button } from './Button';
import { PersonLink } from './PersonLink';
import { Text } from './Text';

export function VenueStaff({ groupId, isVenue, me }: { groupId: string; isVenue: boolean; me: Pick<User, 'id' | 'account_type'> }) {
  const staff = useAsync(() => api.getVenueStaff(groupId), [groupId]);
  const rows = staff.data ?? [];
  const approved = rows.filter((r) => r.status === 'approved');
  const pending = rows.filter((r) => r.status === 'pending');
  const mine = rows.find((r) => r.user_id === me.id);
  const act = async (action: () => Promise<void>) => {
    await action();
    staff.reload();
  };
  if (!staff.data) return null;
  // nothing to show to a visitor when there's no staff and they can't ask (another venue)
  if (!approved.length && !isVenue && me.account_type !== 'person') return null;

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-ink">Lo staff</Text>
      {approved.length ? (
        <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          {approved.map((r, index) => (
            <View key={r.user_id} className={`flex-row items-center gap-3 p-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
              <PersonLink userId={r.user_id} name={r.user.full_name} className="flex-1 flex-row items-center gap-3">
                <Avatar {...avatarOf(r.user)} size={36} />
                <Text className="flex-1 font-medium text-ink">{r.user.full_name}</Text>
              </PersonLink>
              {isVenue ? <Button title="Togli" size="sm" variant="muted" onPress={() => act(() => api.removeStaff(groupId, r.user_id))} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-stone-500">{isVenue ? 'Chi lavora da voi tocca “Lavoro qui” su questa pagina.' : 'Nessuno ancora.'}</Text>
      )}

      {/* The venue: the requests to approve */}
      {isVenue && pending.length ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-stone-500">DICONO DI LAVORARE DA VOI</Text>
          {pending.map((r) => (
            <View key={r.user_id} className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
              <PersonLink userId={r.user_id} name={r.user.full_name} className="flex-1 flex-row items-center gap-3">
                <Avatar {...avatarOf(r.user)} size={36} />
                <Text className="flex-1 font-medium text-ink">{r.user.full_name}</Text>
              </PersonLink>
              <Button title="Approva" size="sm" onPress={() => act(() => api.approveStaff(groupId, r.user_id))} />
              <Button title="No" size="sm" variant="muted" onPress={() => act(() => api.removeStaff(groupId, r.user_id))} />
            </View>
          ))}
        </View>
      ) : null}

      {/* A person: ask, wait, or leave */}
      {!isVenue && me.account_type === 'person' ? (
        !mine ? (
          <Button title="Lavoro qui" icon="briefcase-outline" variant="secondary" onPress={() => act(() => api.askToJoinStaff(me.id, groupId))} />
        ) : mine.status === 'pending' ? (
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 text-sm text-stone-600">Richiesta inviata: il locale deve approvarla.</Text>
            <Button title="Annulla" size="sm" variant="muted" onPress={() => act(() => api.removeStaff(groupId, me.id))} />
          </View>
        ) : (
          <Button title="Lascia lo staff" size="sm" variant="muted" onPress={() => act(() => api.removeStaff(groupId, me.id))} />
        )
      ) : null}
    </View>
  );
}
