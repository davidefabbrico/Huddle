// "Chi lo vede?" for events and holidays: everyone who sees the group, or only its members and guests.
// In a private group events are always private.

import { Text, View } from 'react-native';
import type { EventVisibility } from '../lib/types';
import { Chip } from './Chip';
import { InfoTip } from './InfoTip';

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
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-medium text-stone-700">Chi lo vede?</Text>
        {groupIsPrivate ? null : (
          <InfoTip text={`Tutti: chiunque può trovare ${what}, chiedere di entrare nel gruppo e vederne le foto. Solo il gruppo: lo vedono solo membri e ospiti.`} />
        )}
      </View>
      {groupIsPrivate ? (
        <Text className="text-sm text-stone-500">🔒 Solo il gruppo (il gruppo è privato)</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="🌍 Tutti" selected={value === 'public'} onPress={() => onChange('public')} />
            <Chip label="🔒 Solo il gruppo" selected={value === 'private'} onPress={() => onChange('private')} />
          </View>
        </>
      )}
    </View>
  );
}
