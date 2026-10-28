/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every folder that contains components using `className`
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (not the default 'media'): NativeWind 4.2.7 throws on web with 'media'.
  // The app is light-only for now (app.json userInterfaceStyle).
  darkMode: 'class',
  theme: {
    extend: {
      // `wide:` = computer layout (side menu, more columns). Keep in sync with WIDE_MIN_WIDTH in hooks/useLayout.ts
      screens: { wide: '900px' },
      // Huddle brand palette (warm, welcoming)
      colors: {
        // From CSS variables (global.css): inside a group they become the group's pastel palette
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800].map((tone) => [tone, `rgb(var(--brand-${tone}) / <alpha-value>)`]),
        ),
        ink: '#1F2430',
        // Material 3 surface: the page background (white cards sit on it)
        surface: '#F6F3F1',
      },
    },
  },
  plugins: [],
};
