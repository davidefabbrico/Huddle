// Holiday plan: things to do ("Da fare") and to see ("Da vedere"), optionally on a day of the holiday.
// Every member and guest can add, tick, rename (tap the text) and remove items.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../lib/api';
import { shortDayLabel } from '../lib/format';
import type { TripItem } from '../lib/types';
import { Button } from './Button';
import { Chip } from './Chip';
import { colors } from './theme';

interface Props {
  eventId: string;
  myId: string;
  days: string[]; // the holiday's days, "YYYY-MM-DD"
  items: TripItem[];
  canEdit: boolean; // members and guests
  onChanged: () => void;
}

const kindLabel = { todo: '✅ Da fare', see: '📍 Da vedere' } as const;

export function TripPlan({ eventId, myId, days, items, canEdit, onChanged }: Props) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TripItem['kind']>('see');
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modifica non riuscita');
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      await api.addTripItem(myId, eventId, { title, kind, day });
      setTitle('');
    });

  // Items without a day first ("Quando capita"), then day by day
  const groups = [
    { key: 'any', label: 'Quando capita', items: items.filter((i) => !i.day) },
    ...days.map((d) => ({ key: d, label: shortDayLabel(d), items: items.filter((i) => i.day === d) })),
  ].filter((g) => g.items.length > 0);
  const done = items.filter((i) => i.done).length;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-ink">La scaletta</Text>
        {items.length ? <Text className="text-sm text-stone-500">{done}/{items.length} fatti</Text> : null}
      </View>

      {groups.length === 0 ? (
        <Text className="text-stone-500">Ancora vuota: aggiungete cosa volete fare e vedere, giorno per giorno.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.key} className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500">{group.label}</Text>
            <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
              {group.items.map((item, index) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  first={index === 0}
                  canEdit={canEdit}
                  busy={busy}
                  onToggle={() => run(() => api.updateTripItem(item.id, { done: !item.done }))}
                  onRename={(newTitle) => run(() => api.updateTripItem(item.id, { title: newTitle }))}
                  onDelete={() => run(() => api.deleteTripItem(item.id))}
                />
              ))}
            </View>
          </View>
        ))
      )}

      {canEdit ? (
        <View className="gap-2 rounded-3xl bg-white p-3">
          <View className="flex-row flex-wrap gap-2">
            {(['see', 'todo'] as const).map((k) => (
              <Chip key={k} label={kindLabel[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={add}
            placeholder={kind === 'see' ? 'Es. Cattedrale di Monreale' : 'Es. Prenotare la barca'}
            placeholderTextColor="#A8A29E"
            maxLength={200}
            className="h-11 rounded-2xl border border-stone-300 bg-white px-4 text-base text-ink"
          />
          {days.length > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              <Chip label="Quando capita" selected={day === null} onPress={() => setDay(null)} />
              {days.map((d) => (
                <Chip key={d} label={shortDayLabel(d)} selected={day === d} onPress={() => setDay(d)} />
              ))}
            </View>
          ) : null}
          <Button title="Aggiungi alla scaletta" icon="add" size="sm" disabled={busy || !title.trim()} onPress={add} />
          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function PlanRow({ item, first, canEdit, busy, onToggle, onRename, onDelete }: {
  item: TripItem;
  first: boolean;
  canEdit: boolean;
  busy: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.title);
  const save = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== item.title) onRename(text);
    else setText(item.title);
  };

  return (
    <View className={`flex-row items-center gap-3 px-3 py-2.5 ${first ? '' : 'border-t border-stone-100'}`}>
      <Pressable
        onPress={canEdit && !busy ? onToggle : undefined}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        aria-checked={item.done}
        accessibilityLabel={item.title}
        hitSlop={6}
      >
        <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.done ? colors.green : colors.muted} />
      </Pressable>
      <Text className="text-base">{item.kind === 'see' ? '📍' : '✅'}</Text>
      {editing ? (
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={save}
          onBlur={save}
          autoFocus
          maxLength={200}
          className="h-9 flex-1 rounded-xl border border-brand-500 bg-white px-2 text-base text-ink"
        />
      ) : (
        <Pressable onPress={canEdit ? () => setEditing(true) : undefined} className="flex-1" accessibilityHint={canEdit ? 'Tocca per modificare' : undefined}>
          <Text className={`text-base ${item.done ? 'text-stone-400 line-through' : 'text-ink'}`}>{item.title}</Text>
        </Pressable>
      )}
      {canEdit ? (
        <Pressable onPress={busy ? undefined : onDelete} accessibilityRole="button" accessibilityLabel={`Togli ${item.title}`} hitSlop={6}>
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
