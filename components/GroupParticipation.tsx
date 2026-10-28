// "Partecipano come gruppo" on an event: the groups that joined it as a whole (how many of their members
// are coming, how many haven't answered yet), and for a group's admin "Ci veniamo come gruppo" / "Ritira".
// Only public events of public groups, still to come. Every member of a joined group gets a notification
// and answers for themselves (join_event_as_group in the database).

import { useState } from 'react';
import { View } from 'react-native';
import type { EventGroupSummary, Group } from '../lib/types';
import { Button } from './Button';
import { GroupIcon, groupIconOf } from './GroupIcon';
import { Text } from './Text';

interface Props {
  joined: EventGroupSummary[];
  myAdminGroups: Pick<Group, 'id' | 'name' | 'icon' | 'color'>[]; // groups you run (not the organizing one)
  canJoinNow: boolean; // public, upcoming, not cancelled
  busy: boolean;
  onJoin: (groupId: string) => void;
  onLeave: (groupId: string) => void;
}

export function GroupParticipation({ joined, myAdminGroups, canJoinNow, busy, onJoin, onLeave }: Props) {
  const [choosing, setChoosing] = useState(false);
  const joinedIds = new Set(joined.map((g) => g.group_id));
  const mine = new Set(myAdminGroups.map((g) => g.id));
  const available = canJoinNow ? myAdminGroups.filter((g) => !joinedIds.has(g.id)) : [];
  if (!joined.length && !available.length) return null;

  return (
    <View className="gap-3">
      {joined.length ? (
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Partecipano come gruppo</Text>
          {joined.map((g) => {
            const waiting = Math.max(0, g.members - g.answered);
            return (
              <View key={g.group_id} className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <GroupIcon {...groupIconOf(g)} size={36} />
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{g.name}</Text>
                  <Text className="text-sm text-stone-500">
                    {g.going} {g.going === 1 ? 'c’è' : 'ci sono'}
                    {waiting ? ` · ${waiting} in attesa` : ''}
                  </Text>
                </View>
                {mine.has(g.group_id) && canJoinNow ? (
                  <Button title="Ritira" size="sm" variant="muted" disabled={busy} onPress={() => onLeave(g.group_id)} />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {available.length === 1 ? (
        <Button title={`Ci veniamo come ${available[0].name}`} icon="people" variant="secondary" disabled={busy} onPress={() => onJoin(available[0].id)} />
      ) : available.length > 1 ? (
        choosing ? (
          <View className="gap-2">
            <Text className="text-sm text-stone-600">Con quale gruppo? Ognuno riceverà l’invito a rispondere.</Text>
            {available.map((g) => (
              <Button key={g.id} title={g.name} icon="people" variant="secondary" disabled={busy} onPress={() => onJoin(g.id)} />
            ))}
          </View>
        ) : (
          <Button title="Ci veniamo come gruppo" icon="people" variant="secondary" onPress={() => setChoosing(true)} />
        )
      ) : null}
    </View>
  );
}
