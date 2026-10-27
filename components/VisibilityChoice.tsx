// "Chi lo vede?" for events and holidays: everyone who sees the group, or only its members and guests.
// In a private group events are always private.

import { Text, View } from 'react-native';
import type { EventVisibility } from '../lib/types';
import { Chip } from './Chip';

interface Props {
  value: EventVisibility;
  onChange: (value: EventVisibility) => void;
  groupIsPrivate: boolean;
  isTrip?: boolean;
}

export function VisibilityChoice({ value, onChange, groupIsPrivate, isTrip = false }: Props) {
  const what = isTrip ? 'la vacanza' : 'l’evento';
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-stone-700">Chi lo vede?</Text>
      {groupIsPrivate ? (
        <Text className="text-sm text-stone-500">🔒 Il gruppo è privato: {what} lo vede solo chi ne fa parte.</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="🌍 Tutti" selected={value === 'public'} onPress={() => onChange('public')} />
            <Chip label="🔒 Solo il gruppo" selected={value === 'private'} onPress={() => onChange('private')} />
          </View>
          <Text className="text-xs text-stone-500">
            {value === 'public'
              ? `Chiunque può trovare ${what}, chiedere di entrare nel gruppo e vederne le foto.`
              : `Solo membri e ospiti del gruppo vedono ${what} (e le sue foto).`}
          </Text>
        </>
      )}
    </View>
  );
}
