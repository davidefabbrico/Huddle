/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every folder that contains components using `className`
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (not the default 'media'): NativeWind 4.2.7 throws on web with 'media'.
  // The dark theme doesn't use dark: classes: the colors are CSS variables (components/AppTheme.tsx).
  darkMode: 'class',
  theme: {
    // Arcade look, like the pixel mascots: corners are (almost) square everywhere, "rounded-full" too
    borderRadius: {
      none: '0px',
      sm: '1px',
      DEFAULT: '2px',
      md: '2px',
      lg: '2px',
      xl: '3px',
      '2xl': '3px',
      '3xl': '4px',
      full: '4px',
    },
    extend: {
      // Pixel font for the "Huddle" logo (Huddle Pixel = Pixelify Sans without ligatures, assets/fonts).
      // The rest of the text is Chakra Petch, set by components/Text.tsx.
      fontFamily: {
        pixel: ['HuddlePixel-Bold'],
      },
      // `wide:` = computer layout (side menu, more columns). Keep in sync with WIDE_MIN_WIDTH in hooks/useLayout.ts
      screens: { wide: '900px' },
      // Huddle brand palette (warm, welcoming)
      colors: {
        // From CSS variables (global.css): inside a group they become the group's pastel palette
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800].map((tone) => [tone, `rgb(var(--brand-${tone}) / <alpha-value>)`]),
        ),
        // Neutrals from CSS variables too (lib/palette.ts NEUTRALS): they flip in the dark theme.
        // "white" is the cards' color (dark grey at night), "surface" the page, "surface2" the bars.
        white: 'rgb(var(--white) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        stone: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((tone) => [tone, `rgb(var(--stone-${tone}) / <alpha-value>)`]),
        ),
      },
    },
  },
  plugins: [],
};
