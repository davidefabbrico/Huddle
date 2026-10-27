// Web: a link opened while signed out (an invite, a group, an event) is reopened after signing in,
// also when sign-in happens in another tab (the "confirm your email" link opens a new one).

import { Platform } from 'react-native';

const KEY = 'huddle.afterLogin';
const MAX_AGE_MS = 24 * 3600e3;
const LINK = /^\/(invite|group|event)\//;

// The current path without the GitHub Pages base (/Huddle)
function currentPath(): string {
  const base = process.env.EXPO_BASE_URL ?? '';
  const path = window.location.pathname;
  return base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
}

// Call once at startup, before the route guard redirects to the login
export function rememberOpenedLink(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const path = currentPath();
  if (!LINK.test(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path: path + window.location.search, at: Date.now() }));
  } catch {
    // storage blocked (private browsing): the link is simply not remembered
  }
}

// The remembered link (once: it's forgotten after reading), or null
export function takeRememberedLink(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path: string; at: number } | null;
    localStorage.removeItem(KEY);
    return saved && Date.now() - saved.at < MAX_AGE_MS ? saved.path : null;
  } catch {
    return null;
  }
}
