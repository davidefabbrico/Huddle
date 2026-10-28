// Pastel tonal palettes, Material 3 style: the app's own (peach) and one per group color.
// Inside a group (GroupTheme) the "brand" colors become the group's: every bg-brand-*, text-brand-*
// and border-brand-* class follows, because tailwind.config.js reads them from CSS variables.
//   50–200: surfaces and containers (pastel)   300: filled buttons   400–500: accents
//   600–800: text and icons on pastel (dark enough to read)

import type { GroupColor } from './groupIcons';

export type Tone = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800;
export type Palette = Record<Tone, string>;

export const APP_PALETTE: Palette = {
  50: '#FFF6F1', 100: '#FFE9DD', 200: '#FFD5C0', 300: '#FBBB9A', 400: '#F59E74',
  500: '#EC8357', 600: '#C9643C', 700: '#9C4A2B', 800: '#6B321E',
};

export const GROUP_PALETTES: Record<GroupColor, Palette> = {
  orange: APP_PALETTE,
  rose: {
    50: '#FFF5F7', 100: '#FFE4EA', 200: '#FECDD8', 300: '#F9AEC0', 400: '#F0869F',
    500: '#E2637F', 600: '#BE4462', 700: '#93314A', 800: '#642132',
  },
  violet: {
    50: '#F8F5FF', 100: '#EFE9FF', 200: '#DFD5FE', 300: '#C7B8FC', 400: '#A98EF7',
    500: '#8D6EEB', 600: '#6E50CC', 700: '#543CA0', 800: '#38286C',
  },
  sky: {
    50: '#F2F9FE', 100: '#E1F1FD', 200: '#C5E4FB', 300: '#9DD0F6', 400: '#6AB4EC',
    500: '#4198D8', 600: '#2D78B2', 700: '#225B88', 800: '#173E5D',
  },
  teal: {
    50: '#F0FBF9', 100: '#DAF5F0', 200: '#B7EBE2', 300: '#8AD9CC', 400: '#56C1AF',
    500: '#31A592', 600: '#228574', 700: '#1A665A', 800: '#12463E',
  },
  green: {
    50: '#F2FBF5', 100: '#DEF5E6', 200: '#BFEBCE', 300: '#94DAAC', 400: '#62C385',
    500: '#3EA666', 600: '#2D8550', 700: '#22663D', 800: '#17452A',
  },
  amber: {
    50: '#FFFBEF', 100: '#FFF3D2', 200: '#FFE6A6', 300: '#FDD474', 400: '#F6BD42',
    500: '#E2A223', 600: '#B88019', 700: '#8C6114', 800: '#5E410D',
  },
  slate: {
    50: '#F7F7F8', 100: '#EDEEF0', 200: '#DCDEE2', 300: '#C1C5CC', 400: '#9DA3AC',
    500: '#7C828E', 600: '#60666F', 700: '#484D55', 800: '#303338',
  },
};

const TONES: Tone[] = [50, 100, 200, 300, 400, 500, 600, 700, 800];

// "#FFE9DD" -> "255 233 221" (the format the CSS variables use, so classes can add opacity)
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

// { '--brand-50': '255 246 241', … } for nativewind's vars()
export function paletteVars(palette: Palette): Record<string, string> {
  return Object.fromEntries(TONES.map((tone) => [`--brand-${tone}`, rgb(palette[tone])]));
}
