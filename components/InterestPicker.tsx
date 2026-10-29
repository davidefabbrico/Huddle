// Choosing interests (profile, onboarding, group, event, search): the categories with their pixel icon,
// and "Altro…" to write one by hand (lib/interests.ts). InterestChips shows them, read-only.

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cleanCustomInterest, INTERESTS, interestIcon, interestLabel, isCategory, MAX_CUSTOM_LENGTH } from '../lib/interests';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import { Text, TextInput } from './Text';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number; // groups 5, events 3; no limit for people
  allowCustom?: boolean; // "Altro…" (not in the search filters)
}

export function InterestPicker({ selected, onChange, max, allowCustom = true }: Props) {
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');
  const full = max !== undefined && selected.length >= max;
  const custom = selected.filter((key) => !isCategory(key));

  const toggle = (key: string) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else if (!full) onChange([...selected, key]);
  };

  function addCustom() {
    const key = cleanCustomInterest(draft);
    if (key && !selected.includes(key) && !full) onChange([...selected, key]);
    setDraft('');
    setWriting(false);
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {INTERESTS.map((interest) => (
          <Tile
            key={interest.key}
            label={interest.label}
            icon={interest.icon}
            selected={selected.includes(interest.key)}
            disabled={full && !selected.includes(interest.key)}
            onPress={() => toggle(interest.key)}
          />
        ))}
        {custom.map((key) => (
          <Tile key={key} label={interestLabel(key)} icon="tag" selected onPress={() => toggle(key)} removable />
        ))}
        {allowCustom && !writing ? (
          <Tile label="Altro…" icon="plus" selected={false} disabled={full} onPress={() => setWriting(true)} />
        ) : null}
      </View>
      {writing ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addCustom}
            autoFocus
            maxLength={MAX_CUSTOM_LENGTH}
            placeholder="Es. origami, scacchi…"
            placeholderTextColor="#A8A29E"
            accessibilityLabel="Un altro interesse"
            className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-base text-ink outline-none"
          />
          <Pressable onPress={addCustom} accessibilityRole="button" className="h-10 justify-center rounded-lg bg-brand-200 px-4 active:bg-brand-300">
            <Text className="font-semibold text-brand-800">Aggiungi</Text>
          </Pressable>
        </View>
      ) : null}
      {max !== undefined ? <Text className="text-xs text-stone-500">Al massimo {max}.</Text> : null}
    </View>
  );
}

function Tile({ label, icon, selected, disabled = false, removable = false, onPress }: {
  label: string;
  icon: PixelIconName;
  selected: boolean;
  disabled?: boolean;
  removable?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      // react-native-web ignores accessibilityState.checked: screen readers on the web need aria-checked
      aria-checked={selected}
      className={`h-10 flex-row items-center gap-2 rounded-lg border px-3 ${selected ? 'border-brand-200 bg-brand-200' : 'border-stone-300 bg-white active:bg-stone-100'} ${disabled ? 'opacity-40' : ''}`}
    >
      <PixelIcon name={icon} size={16} className={selected ? 'text-brand-800' : 'text-stone-500'} />
      <Text className={`text-sm ${selected ? 'font-semibold text-brand-800' : 'text-stone-700'}`}>{label}</Text>
      {removable ? <Text className="text-sm text-brand-800">✕</Text> : null}
    </Pressable>
  );
}

// Read-only: the interests with their icon (profile). `shared`: the ones you have too stand out, first.
export function InterestChips({ keys, shared }: { keys: string[]; shared?: Set<string> }) {
  const sorted = shared ? [...keys].sort((a, b) => Number(shared.has(b)) - Number(shared.has(a))) : keys;
  return (
    <View className="flex-row flex-wrap gap-2">
      {sorted.map((key) => {
        const common = shared?.has(key) ?? false;
        return (
          <View
            key={key}
            accessibilityLabel={common ? `${interestLabel(key)}, in comune` : interestLabel(key)}
            className={`h-8 flex-row items-center gap-1.5 rounded-lg px-2.5 ${common ? 'bg-brand-300' : shared ? 'bg-stone-100' : 'bg-brand-100'}`}
          >
            <PixelIcon name={interestIcon(key)} size={14} className={common ? 'text-brand-800' : shared ? 'text-stone-500' : 'text-brand-700'} />
            <Text className={`text-sm ${common ? 'font-semibold text-brand-800' : shared ? 'text-stone-600' : 'text-brand-700'}`}>
              {interestLabel(key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
