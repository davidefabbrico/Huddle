// Primary/secondary/muted button with optional icon and loading spinner

import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

type Variant = 'primary' | 'secondary' | 'muted';
type Size = 'md' | 'sm';

// Full class names (not built dynamically) so Tailwind can find them
const containerClass: Record<Variant, string> = {
  primary: 'bg-brand-500 active:bg-brand-600',
  secondary: 'border border-brand-500 bg-white active:bg-brand-50',
  muted: 'bg-stone-200',
};
const textClass: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-brand-600',
  muted: 'text-stone-600',
};
const iconColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.brandDark,
  muted: colors.muted,
};

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  size?: Size;
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'md' }: Props) {
  const small = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      className={`flex-row items-center justify-center gap-2 ${small ? 'h-9 rounded-xl px-3' : 'h-12 rounded-2xl px-5'} ${containerClass[variant]} ${disabled ? 'opacity-70' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColor[variant]} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={iconColor[variant]} /> : null}
          <Text className={`font-semibold ${small ? 'text-sm' : 'text-base'} ${textClass[variant]}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
