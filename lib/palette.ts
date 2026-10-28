// Pastel tonal palettes, Material 3 style: the app's own (peach) and one per group color, plus the
// neutrals (page, cards, text, greys) for the light and the dark ("notte") theme.
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

export type ThemeMode = 'light' | 'dark';

// Neutrals: "white" is the cards' and the bars' color (bottom bar, side menu), "surface" the page,
// "surface2" a slightly darker grey.
// The stone greys flip in the dark theme, so text-stone-500 stays readable on both.
export interface Neutrals {
  white: string;
  surface: string;
  surface2: string;
  ink: string;
  line: string; // the arcade outline of the main buttons, the same plum as the mascots' outline
  stone: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
}

export const NEUTRALS: Record<ThemeMode, Neutrals> = {
  light: {
    white: '#FFFFFF',
    surface: '#F8F8F9', // almost white, no brown
    surface2: '#EEEFF2',
    ink: '#1F2430',
    line: '#3A2E39',
    stone: {
      50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1', 400: '#A8A29E',
      500: '#78716C', 600: '#57534E', 700: '#44403C', 800: '#292524', 900: '#1C1917',
    },
  },
  dark: {
    white: '#1E2026',
    surface: '#121316',
    surface2: '#1A1C21',
    ink: '#ECEDEF',
    line: '#4B4556', // lighter than the cards, or the outline would vanish at night
    stone: {
      50: '#1C1D21', 100: '#24262B', 200: '#2E3036', 300: '#3F424A', 400: '#6B6F78',
      500: '#9A9EA6', 600: '#B9BCC3', 700: '#D3D5DA', 800: '#E6E7EA', 900: '#F2F3F5',
    },
  },
};

// "#RRGGBB" a share of the way from `from` to `to`
function mix(from: string, to: string, share: number): string {
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * share).toString(16).padStart(2, '0')).join('')}`;
}

// The same palette for the dark theme. Sections (50–100) become dark surfaces barely tinted; filled
// things (200–300: buttons, selected chips, pills, my chat bubbles) stay pastel, with dark text (800),
// like the other pastel labels; accents and text on dark (600–700) become light pastel. So every pair
// used in the app (bg-brand-200 + text-brand-800, bg-brand-50 + text-brand-700…) stays readable,
// and the peach never turns brown.
export function darkPalette(palette: Palette): Palette {
  const base = NEUTRALS.dark.white;
  return {
    50: mix(base, palette[400], 0.08), 100: mix(base, palette[400], 0.14), 200: palette[200], 300: palette[300],
    400: palette[300], 500: palette[400], 600: palette[300], 700: palette[200], 800: palette[800],
  };
}

export const paletteFor = (palette: Palette, mode: ThemeMode) => (mode === 'dark' ? darkPalette(palette) : palette);

// All the CSS variables of a theme: neutrals + the brand palette
export function themeVars(mode: ThemeMode, palette: Palette): Record<string, string> {
  const n = NEUTRALS[mode];
  return {
    '--white': rgb(n.white),
    '--surface': rgb(n.surface),
    '--surface2': rgb(n.surface2),
    '--ink': rgb(n.ink),
    '--line': rgb(n.line),
    ...Object.fromEntries(Object.entries(n.stone).map(([tone, hex]) => [`--stone-${tone}`, rgb(hex)])),
    ...paletteVars(paletteFor(palette, mode)),
  };
}
