// Event photos: one per person, added once the event has started. Seen by whoever sees the group,
// so for a public group also by people from other groups. You change or remove yours; the group
// admin can remove any. Tap a photo to open it full size.

import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useGridColumns } from '../hooks/useLayout';
import * as api from '../lib/api';
import { firstName } from '../lib/format';
import { pickEventPhoto } from '../lib/pickers';
import type { EventPhoto, User } from '../lib/types';
import { Button } from './Button';
import { InfoTip } from './InfoTip';

interface Props {
  eventId: string;
  myId: string;
  photos: EventPhoto[];
  people: Pick<User, 'id' | 'full_name'>[];
  canAdd: boolean; // member or guest, and the event has started
  isAdmin: boolean;
  isPublic: boolean; // public group: everyone can see the photos
  onChanged: () => void;
}

export function EventPhotos({ eventId, myId, photos, people, canAdd, isAdmin, isPublic, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const columns = useGridColumns() + 1; // 2 on phones, 3–4 on a computer
  const mine = photos.find((p) => p.user_id === myId);
  const nameOf = (id: string) => (id === myId ? 'Tu' : firstName(people.find((p) => p.id === id)?.full_name ?? 'Qualcuno'));

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito');
    } finally {
      setBusy(false);
    }
  }

  if (!photos.length && !canAdd) return null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-ink">Foto{photos.length ? ` (${photos.length})` : ''}</Text>
        {canAdd ? (
          <InfoTip
            text={`Una foto a testa. ${isPublic ? 'Il gruppo è pubblico: le vedono anche le persone di altri gruppi.' : 'Il gruppo è privato: le vede solo chi ne fa parte.'}`}
          />
        ) : null}
      </View>
      {photos.length ? (
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
          {photos.map((photo) => (
            <View key={photo.user_id} style={{ width: `${100 / columns}%`, padding: 4 }}>
              <Pressable onPress={() => Linking.openURL(photo.url)} accessibilityRole="imagebutton" accessibilityLabel={`Foto di ${nameOf(photo.user_id)}`}>
                <Image source={{ uri: photo.url }} className="w-full rounded-2xl bg-stone-200" style={{ aspectRatio: 1 }} resizeMode="cover" />
              </Pressable>
              <View className="mt-1 flex-row items-center justify-between gap-1">
                <Text numberOfLines={1} className="flex-1 text-xs text-stone-600">
                  {nameOf(photo.user_id)}
                </Text>
                {isAdmin && photo.user_id !== myId ? (
                  <Pressable onPress={busy ? undefined : () => run(() => api.removeEventPhoto(eventId, photo.user_id))} accessibilityRole="button" hitSlop={6}>
                    <Text className="text-xs font-semibold text-red-600">Rimuovi</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-stone-500">Ancora nessuna foto: aggiungi la tua!</Text>
      )}

      {canAdd ? (
        <View className="flex-row flex-wrap gap-2">
          <Button
            title={mine ? 'Cambia la tua foto' : 'Aggiungi la tua foto'}
            icon="camera-outline"
            size="sm"
            variant="secondary"
            loading={busy}
            onPress={() =>
              run(async () => {
                const file = await pickEventPhoto();
                if (file) await api.setMyEventPhoto(myId, eventId, file);
              })
            }
          />
          {mine ? (
            <Button title="Togli la tua" size="sm" variant="muted" disabled={busy} onPress={() => run(() => api.setMyEventPhoto(myId, eventId, null))} />
          ) : null}
        </View>
      ) : null}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
