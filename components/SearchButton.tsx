// Round "Cerca" button for the page headers on phones (on a computer it's in the side menu)

import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useIsWide } from '../hooks/useLayout';
import { colors } from './theme';

export function SearchButton() {
  const wide = useIsWide();
  if (wide) return null;
  return (
    <Link href="/search" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerca"
        className="h-11 w-11 items-center justify-center rounded-full bg-white active:bg-stone-200"
      >
        <Ionicons name="search" size={22} color={colors.ink} />
      </Pressable>
    </Link>
  );
}
