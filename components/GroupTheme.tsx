// Inside a group (its page, chat, events, history, organizing for it) the app takes the group's
// pastel color: the "brand" CSS variables are redefined for this subtree (nativewind vars), and
// useBrand() gives the same palette to icons and spinners that need a value.

import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { groupLook } from '../lib/groupIcons';
import { APP_PALETTE, GROUP_PALETTES, paletteVars, type Palette } from '../lib/palette';

const BrandContext = createContext<Palette>(APP_PALETTE);

export const useBrand = () => useContext(BrandContext);

export function GroupTheme({
  group,
  children,
}: {
  group: { name: string; icon?: string | null; color?: string | null } | null | undefined;
  children: ReactNode;
}) {
  const palette = group ? GROUP_PALETTES[groupLook(group).color] : APP_PALETTE;
  return (
    <BrandContext.Provider value={palette}>
      <View className="flex-1" style={vars(paletteVars(palette))}>
        {children}
      </View>
    </BrandContext.Provider>
  );
}
