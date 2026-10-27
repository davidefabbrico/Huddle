// Venue's own event: "Promuovi ai gruppi della zona". Spends points (PROMOTION_COST) to send the
// event to the members of the groups within the chosen distance of the event (once per event).

import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import * as api from '../lib/api';
import { PROMOTION_COST } from '../lib/points';
import { Button } from './Button';
import { Chip } from './Chip';

const RADII_KM = [5, 10, 25];

export function PromoteCard({ eventId, hasPlace }: { eventId: string; hasPlace: boolean }) {
  const [radius, setRadius] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ groups: number; people: number }>();
  const state = useAsync(async () => {
    const [promoted, points] = await Promise.all([api.wasPromoted(eventId), api.getMyPoints()]);
    return { promoted, balance: points.earned - points.spent };
  }, [eventId, result]);

  async function promote() {
    setError(undefined);
    setBusy(true);
    try {
      setResult(await api.promoteEvent(eventId, radius));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promozione non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3 rounded-3xl border border-violet-200 bg-violet-50 p-4">
      <Text className="text-base font-semibold text-violet-950">📣 Fallo sapere ai gruppi della zona</Text>
      {result ? (
        <Text className="text-sm text-violet-900">
          Fatto! Invito mandato a {result.people === 1 ? '1 persona' : `${result.people} persone`} di{' '}
          {result.groups === 1 ? '1 gruppo' : `${result.groups} gruppi`} entro {radius} km.
        </Text>
      ) : state.data?.promoted ? (
        <Text className="text-sm text-violet-900">Hai già promosso questo evento ✓</Text>
      ) : !hasPlace ? (
        <Text className="text-sm text-violet-900">
          Per promuoverlo scegli il luogo dai suggerimenti: serve per trovare i gruppi vicini.
        </Text>
      ) : (
        <>
          <Text className="text-sm text-violet-900">
            I membri dei gruppi vicini ricevono un invito (chi non vuole inviti dai locali non lo riceve). Costa{' '}
            {PROMOTION_COST} punti: ne hai {state.data?.balance ?? '…'}.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {RADII_KM.map((km) => (
              <Chip key={km} label={`entro ${km} km`} selected={radius === km} onPress={() => setRadius(km)} />
            ))}
          </View>
          <Button
            title={`Promuovi (${PROMOTION_COST} punti)`}
            icon="megaphone"
            size="sm"
            loading={busy}
            disabled={state.data !== undefined && state.data.balance < PROMOTION_COST}
            onPress={promote}
          />
        </>
      )}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
