// Small display helpers shared by screens and components (Italian locale)

import type { UserIntent } from './types';

const LOCALE = 'it-IT';

// "mar 28 ott · 19:30"
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${formatTime(iso)}`;
}

// "19:30"
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

// Day number and short month for the event date tile, e.g. { day: '28', month: 'OTT' }
export function dateTile(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

// Chat timestamp: time only for today, otherwise short date + time
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return formatTime(iso);
  return `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} ${formatTime(iso)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const intentLabels: Record<UserIntent, string> = {
  friends: 'Amicizie',
  group: 'Un gruppo fisso',
  friends_and_dating: 'Amicizie e incontri',
};
