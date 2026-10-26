/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every folder that contains components using `className`
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (not the default 'media'): NativeWind 4.2.7 throws on web with 'media'.
  // The app is light-only for now (app.json userInterfaceStyle).
  darkMode: 'class',
  theme: {
    extend: {
      // Huddle brand palette (warm, welcoming)
      colors: {
        brand: {
          50: '#FFF4ED',
          100: '#FFE6D5',
          500: '#F26B3A',
          600: '#DB5426',
          700: '#B5401C',
        },
        ink: '#1F2430',
      },
    },
  },
  plugins: [],
};
