// Light or dark ("notte") theme: the user's choice (Automatico follows the phone/computer), remembered
// on this device (localStorage: the browser's, or expo-sqlite's on the phone, see lib/sessionStorage).
// Until you choose, it's light.

import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import type { ThemeMode } from '../lib/palette';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'huddle.theme';

function saved(): ThemePreference {
  try {
    const value = globalThis.localStorage?.getItem(KEY);
    return value === 'dark' || value === 'system' ? value : 'light';
  } catch {
    return 'light';
  }
}

export const useThemePreference = create<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void }>((set) => ({
  preference: saved(),
  setPreference: (preference) => {
    try {
      globalThis.localStorage?.setItem(KEY, preference);
    } catch {
      // not remembered (private browsing): it still applies now
    }
    set({ preference });
  },
}));

// The theme to show now
export function useThemeMode(): ThemeMode {
  const preference = useThemePreference((state) => state.preference);
  const system = useColorScheme();
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}
