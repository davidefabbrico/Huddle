// Raw color values for places that need a value, not a class (icons, spinners).
// brand/brandDark: the app's pastel palette (lib/palette.ts); inside a group use useBrand() instead.
// For text and icon colors that follow the light/dark theme use classes (text-ink, text-stone-500).

// Off track of switches: readable on both themes
export const SWITCH_OFF = '#A8A29E80';

export const colors = {
  brand: '#EC8357', // APP_PALETTE[500]
  brandDark: '#C9643C', // APP_PALETTE[600]
  ink: '#1F2430',
  muted: '#78716C', // stone-500
  sky: '#0369A1', // sky-700
  green: '#047857', // emerald-700
  white: '#FFFFFF',
};
