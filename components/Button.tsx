// Material 3 buttons, pastel: filled (primary), outlined (secondary), tonal neutral (muted).
// Fully rounded; dark text on pastel so it stays readable. Colors follow the group (GroupTheme).

import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrand } from './GroupTheme';
import { colors } from './theme';

type Variant = 'primary' | 'secondary' | 'muted';
type Size = 'md' | 'sm';

// Full class names (not built dynamically) so Tailwind can find them
const containerClass: Record<Variant, string> = {
  primary: 'bg-brand-300 active:bg-brand-400',
  secondary: 'border border-brand-300 active:bg-brand-50',
  muted: 'bg-stone-200/70 active:bg-stone-200',
};
const textClass: Record<Variant, string> = {
  primary: 'text-brand-800',
  secondary: 'text-brand-700',
  muted: 'text-stone-700',
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
  const brand = useBrand();
  const small = size === 'sm';
  const iconColor = variant === 'primary' ? brand[800] : variant === 'secondary' ? brand[700] : colors.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      className={`flex-row items-center justify-center gap-2 rounded-full ${small ? 'h-9 px-4' : 'h-12 px-6'} ${containerClass[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={iconColor} /> : null}
          <Text className={`font-semibold ${small ? 'text-sm' : 'text-base'} ${textClass[variant]}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
