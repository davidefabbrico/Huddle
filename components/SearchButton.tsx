// Round "Cerca" button for the page headers on phones (on a computer it's in the side menu)

import { Pressable } from 'react-native';
import { PixelIcon } from './PixelIcon';
import { Link } from 'expo-router';
import { useIsWide } from '../hooks/useLayout';

export function SearchButton() {
  const wide = useIsWide();
  if (wide) return null;
  return (
    <Link href="/search" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerca"
        className="h-11 w-11 items-center justify-center rounded-full border-2 border-b-4 border-line bg-white active:border-b-2 active:bg-stone-200"
      >
        <PixelIcon name="search" size={20} className="text-ink" />
      </Pressable>
    </Link>
  );
}
