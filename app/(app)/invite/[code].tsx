// Invite link (/invite/<code>): preview of the group, also when it's private, and "Chiedi di unirti".
// The admin still approves the request. Opened while signed out, it comes back here after login.

import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { GroupIcon } from '../../../components/GroupIcon';
import { Header } from '../../../components/Header';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import * as api from '../../../lib/api';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const invite = useAsync(() => api.getGroupByInvite(code), [code, version]);
  const group = invite.data;

  const openGroup = () => group && router.replace({ pathname: '/group/[id]', params: { id: group.id } });

  async function requestToJoin() {
    setError(undefined);
    setBusy(true);
    try {
      await api.requestJoinByInvite(code);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Richiesta non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Invito" />
      {invite.data === undefined && !invite.error ? (
        <ActivityIndicator color={colors.brand} className="mt-10" />
      ) : !group ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-center text-lg font-semibold text-ink">Link non valido o scaduto</Text>
          <Text className="text-center text-stone-500">
            Chiedi a chi ti ha invitato un link nuovo: l’admin del gruppo può averlo cambiato.
          </Text>
          <Button title="Vai ai gruppi" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="flex-grow justify-center gap-5 px-6 py-8">
          <View className="items-center gap-2">
            <GroupIcon name={group.name} icon={group.icon} color={group.color} size={96} />
            <Text className="text-center text-sm text-stone-500">Hai un invito per</Text>
            <Text className="text-center text-2xl font-bold text-ink">{group.name}</Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {group.visibility === 'private' ? <Badge label="Gruppo privato" icon="lock-closed" tone="brand" /> : null}
              <Badge label={group.member_count === 1 ? '1 membro' : `${group.member_count} membri`} icon="people" />
            </View>
            {group.description ? <Text className="text-center text-base leading-6 text-stone-600">{group.description}</Text> : null}
          </View>

          {group.my_status === 'member' || group.my_status === 'accepted' || group.my_status === 'guest' ? (
            <Button title="Apri il gruppo" icon="arrow-forward" onPress={openGroup} />
          ) : group.my_status === 'pending' ? (
            <View className="gap-2">
              <Button title="Richiesta inviata ✓" icon="hourglass-outline" variant="muted" disabled />
              <Text className="text-center text-sm text-stone-500">
                L’admin deve approvarla: riceverai una notifica. Intanto puoi vedere il gruppo.
              </Text>
              <Button title="Vedi il gruppo" variant="secondary" onPress={openGroup} />
            </View>
          ) : group.type === 'closed' ? (
            <Button title="Il gruppo al momento è al completo" icon="lock-closed" variant="muted" disabled />
          ) : (
            <View className="gap-2">
              <Button title="Chiedi di unirti" icon="person-add" loading={busy} onPress={requestToJoin} />
              <Text className="text-center text-sm text-stone-500">Il gruppo vedrà il tuo profilo e l’admin approverà.</Text>
            </View>
          )}
          {error ? <Text className="text-center text-sm text-red-600">{error}</Text> : null}
        </ScrollView>
      )}
    </Screen>
  );
}
