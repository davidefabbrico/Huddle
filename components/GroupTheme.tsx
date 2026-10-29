// Themes, via CSS variables (nativewind vars), so classes like bg-white, text-ink, text-stone-500 and
// bg-brand-200 follow them without dark: variants:
//   AppTheme (at the root): light or dark neutrals + the app's pastel palette
//   GroupTheme (inside a group: its page, chat, events, history, organizing for it): the group's palette
// useBrand() / useNeutrals() give the same colors to whatever needs a value (icons, spinners, bars).

import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { useThemeMode } from '../hooks/useThemeMode';
import { groupLook } from '../lib/groupIcons';
import { APP_PALETTE, GROUP_PALETTES, NEUTRALS, paletteFor, paletteVars, themeVars, type Palette, type ThemeMode } from '../lib/palette';

const ThemeContext = createContext<{ mode: ThemeMode; palette: Palette }>({ mode: 'light', palette: APP_PALETTE });

export const useThemeModeContext = () => useContext(ThemeContext).mode;
export const useBrand = () => {
  const { mode, palette } = useContext(ThemeContext);
  return paletteFor(palette, mode);
};
export const useNeutrals = () => NEUTRALS[useContext(ThemeContext).mode];
// All the theme's variables (light/dark, the group's palette), for what is drawn outside the themed
// views: a Modal opens above the app, so it has to carry them itself (components/Sheet.tsx)
export const useThemeVars = () => {
  const { mode, palette } = useContext(ThemeContext);
  return vars(themeVars(mode, palette));
};

export function AppTheme({ children }: { children: ReactNode }) {
  const mode = useThemeMode();
  return (
    <ThemeContext.Provider value={{ mode, palette: APP_PALETTE }}>
      <View className="flex-1 bg-surface" style={vars(themeVars(mode, APP_PALETTE))}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function GroupTheme({
  group,
  children,
}: {
  group: { name: string; icon?: string | null; color?: string | null } | null | undefined;
  children: ReactNode;
}) {
  const { mode } = useContext(ThemeContext);
  const palette = group ? GROUP_PALETTES[groupLook(group).color] : APP_PALETTE;
  return (
    <ThemeContext.Provider value={{ mode, palette }}>
      <View className="flex-1" style={vars(paletteVars(paletteFor(palette, mode)))}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
