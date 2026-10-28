// Small pill labels (Material 3 tonal): "Da poco in città" for relocated users, plus generic tags

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrand, useNeutrals } from './GroupTheme';
import { colors } from './theme';
import { Text } from './Text';

type Tone = 'sky' | 'green' | 'stone' | 'brand';

const toneClass: Record<Tone, { box: string; text: string; icon: string }> = {
  sky: { box: 'bg-sky-100', text: 'text-sky-700', icon: colors.sky },
  green: { box: 'bg-emerald-100', text: 'text-emerald-700', icon: colors.green },
  stone: { box: 'bg-stone-200/70', text: 'text-stone-600', icon: '' }, // icon: the theme's grey (useNeutrals)
  brand: { box: 'bg-brand-100', text: 'text-brand-700', icon: '' }, // icon: the group's (useBrand)
};

interface Props {
  label: string;
  tone?: Tone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  centered?: boolean; // center inside a column instead of hugging the left edge
}

export function Badge({ label, tone = 'stone', icon, centered = false }: Props) {
  const brand = useBrand();
  const neutrals = useNeutrals();
  const t = toneClass[tone];
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${centered ? 'self-center' : 'self-start'} ${t.box}`}>
      {icon ? <Ionicons name={icon} size={11} color={tone === 'brand' ? brand[600] : tone === 'stone' ? neutrals.stone[500] : t.icon} /> : null}
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}

// Shown next to users with is_relocated = true
export function RelocatedBadge() {
  return <Badge label="Da poco in città" tone="sky" icon="airplane" />;
}
