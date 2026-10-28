// Safety: block or report a person ("⋯" next to a member, long press on a chat message), hide or
// report a group (bottom of its page), and on the profile the lists to undo blocks and hidden groups.
// Reports go to the app's owner (Supabase -> reports), who can suspend a person or a group.

import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAsync } from '../hooks/useAsync';
import * as api from '../lib/api';
import { firstName } from '../lib/format';
import { Avatar, avatarOf } from './Avatar';
import { Button } from './Button';
import { GroupIcon, groupIconOf } from './GroupIcon';
import { Text, TextInput } from './Text';

// What a person can do about someone else: a sheet with "Blocca" and "Segnala"
export function PersonSheet({ me, person, visible, onClose, onBlocked }: {
  me: string;
  person: { id: string; full_name: string };
  visible: boolean;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const name = firstName(person.full_name);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string>();

  const [blocked, setBlocked] = useState(false);

  async function block() {
    await api.blockUser(me, person.id);
    setBlocked(true);
    setDone(`Hai bloccato ${name}: non vedrete più i messaggi e i nomi l’uno dell’altro. Puoi sbloccarlo/a dal profilo.`);
  }

  // The lists drop the person once the sheet is closed (dropping them now would take the sheet away too)
  const close = () => {
    onClose();
    if (blocked) onBlocked?.();
  };

  return (
    <Sheet visible={visible} onClose={close} title={person.full_name}>
      {done ? (
        <Text className="text-base text-ink">{done}</Text>
      ) : reporting ? (
        <ReportForm target={{ userId: person.id }} onSent={() => setDone('Grazie: la segnalazione è arrivata, la controlleremo.')} />
      ) : (
        <View className="gap-2">
          <Button title={`Blocca ${name}`} icon="ban" variant="secondary" onPress={block} />
          <Button title={`Segnala ${name}`} icon="flag-outline" variant="muted" onPress={() => setReporting(true)} />
        </View>
      )}
    </Sheet>
  );
}

// "⋯" next to a person in a list
export function PersonMenuButton({ me, person, onBlocked }: { me: string; person: { id: string; full_name: string }; onBlocked?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Altro su ${person.full_name}`}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full active:bg-stone-100"
      >
        <Ionicons name="ellipsis-horizontal" size={18} className="text-stone-500" />
      </Pressable>
      {open ? <PersonSheet me={me} person={person} visible onClose={() => setOpen(false)} onBlocked={onBlocked} /> : null}
    </>
  );
}

// Bottom of a group's page: hide it (not if you're in it) or report it
export function GroupSafetyLinks({ me, group, isMember, onHidden }: {
  me: string;
  group: { id: string; name: string };
  isMember: boolean;
  onHidden: () => void;
}) {
  const [sheet, setSheet] = useState<'hide' | 'report' | null>(null);
  const [done, setDone] = useState<string>();
  return (
    <View className="flex-row flex-wrap justify-center gap-4">
      {isMember ? null : (
        <Pressable onPress={() => setSheet('hide')} accessibilityRole="button" hitSlop={6}>
          <Text className="text-sm text-stone-500 underline">Nascondi il gruppo</Text>
        </Pressable>
      )}
      <Pressable onPress={() => setSheet('report')} accessibilityRole="button" hitSlop={6}>
        <Text className="text-sm text-stone-500 underline">Segnala il gruppo</Text>
      </Pressable>
      {sheet ? (
        <Sheet visible onClose={() => setSheet(null)} title={group.name}>
          {done ? (
            <Text className="text-base text-ink">{done}</Text>
          ) : sheet === 'hide' ? (
            <View className="gap-3">
              <Text className="text-base text-stone-600">
                Non lo vedrai più tra i gruppi, nella ricerca, nei suggerimenti e negli eventi. Puoi farlo ricomparire dal profilo.
              </Text>
              <Button
                title="Nascondi"
                icon="eye-off-outline"
                onPress={async () => {
                  await api.hideGroup(me, group.id);
                  setSheet(null);
                  onHidden();
                }}
              />
            </View>
          ) : (
            <ReportForm target={{ groupId: group.id }} onSent={() => setDone('Grazie: la segnalazione è arrivata, la controlleremo.')} />
          )}
        </Sheet>
      ) : null}
    </View>
  );
}

function ReportForm({ target, onSent }: { target: { userId: string } | { groupId: string }; onSent: () => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <View className="gap-3">
      <Text className="text-base text-stone-600">Cosa non va? Lo leggerà solo chi gestisce Huddle.</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Es. messaggi offensivi, spam, profilo falso…"
        placeholderTextColor="#A8A29E"
        multiline
        maxLength={500}
        accessibilityLabel="Il motivo della segnalazione"
        className="h-24 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-ink outline-none"
        style={{ textAlignVertical: 'top' }}
      />
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <Button
        title="Invia la segnalazione"
        icon="flag"
        loading={loading}
        onPress={async () => {
          setError(undefined);
          setLoading(true);
          try {
            await api.report(target, reason);
            onSent();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Invio non riuscito');
            setLoading(false);
          }
        }}
      />
    </View>
  );
}

// A sheet from the bottom over a dimmed page; on a computer a box in the middle
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40 wide:items-center wide:justify-center" onPress={onClose} accessibilityLabel="Chiudi">
        {/* taps inside don't close it */}
        <Pressable className="w-full gap-4 rounded-t-3xl bg-white p-5 pb-8 wide:max-w-md wide:rounded-3xl" onPress={() => {}}>
          <View className="flex-row items-center justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 text-lg font-semibold text-ink">
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={8}>
              <Ionicons name="close" size={22} className="text-stone-500" />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Profilo -> Account: the people you blocked and the groups you hid, to undo it
export function BlockedAndHidden({ me }: { me: string }) {
  const data = useAsync(async () => {
    const [people, groups] = await Promise.all([api.getBlockedUsers(me), api.getHiddenGroups()]);
    return { people, groups };
  }, [me], { refetchOnFocus: true });
  if (!data.data || (!data.data.people.length && !data.data.groups.length)) return null;
  return (
    <View className="gap-2">
      {data.data.people.map((person) => (
        <View key={person.id} className="flex-row items-center gap-3">
          <Avatar {...avatarOf(person)} size={32} />
          <Text numberOfLines={1} className="flex-1 text-base text-ink">
            {person.full_name} · bloccato/a
          </Text>
          <Button title="Sblocca" size="sm" variant="secondary" onPress={async () => {
            await api.unblockUser(me, person.id);
            data.reload();
          }} />
        </View>
      ))}
      {data.data.groups.map((group) => (
        <View key={group.id} className="flex-row items-center gap-3">
          <GroupIcon {...groupIconOf(group)} size={32} />
          <Text numberOfLines={1} className="flex-1 text-base text-ink">
            {group.name} · nascosto
          </Text>
          <Button title="Mostra" size="sm" variant="secondary" onPress={async () => {
            await api.unhideGroup(me, group.id);
            data.reload();
          }} />
        </View>
      ))}
    </View>
  );
}
