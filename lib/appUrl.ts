// Absolute URL of a page of this app, used in emails (confirm account, reset password).
// Web: the current site, including the GitHub Pages base path (/Huddle) when present.
// iOS/Android: a deep link (huddle://… or exp://… in Expo Go).

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function appUrl(path = '/'): string {
  if (Platform.OS !== 'web') return Linking.createURL(path);
  const base = process.env.EXPO_BASE_URL ?? '';
  const prefix = base && window.location.pathname.startsWith(base) ? base : '';
  return `${window.location.origin}${prefix}${path}`;
}
