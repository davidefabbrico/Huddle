// Small display helpers shared by screens and components (Italian locale)

import type { UserIntent, UserRole } from './types';

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

// Section heading for a day: "Oggi", "Domani" or "Sabato 31 ottobre"
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === tomorrow.toDateString()) return 'Domani';
  const label = d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// First person, as shown on your own profile (same wording as signup)
export const roleLabels: Record<UserRole, string> = {
  solo: 'Cerco un gruppo',
  group: 'Il mio gruppo cerca nuovi membri',
};

export const intentLabels: Record<UserIntent, string> = {
  friends: 'Amicizie',
  group: 'Un gruppo fisso',
  friends_and_dating: 'Amicizie e incontri',
};

// Interests offered at signup and in "Modifica profilo"
export const interestOptions = [
  'running',
  'aperitivo',
  'giochi da tavolo',
  'padel',
  'hiking',
  'libri',
  'cucina',
  'musica live',
  'yoga',
  'cinema',
  'fotografia',
  'lingue',
];

// ---- Recurring events and rides ----

// Short weekday names, 1 = Monday (ISO, like event_series.weekdays)
export const weekdayNames = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

// 1 = Monday … 7 = Sunday, for a date
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

// "ogni lun, mer, ven" / "ogni giorno"
export function weekdaysLabel(weekdays: number[]): string {
  if (weekdays.length === 7) return 'ogni giorno';
  return `ogni ${[...weekdays].sort().map((d) => weekdayNames[d - 1]).join(', ')}`;
}

// Database time "18:30:00" -> "18:30"
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

// "19.30" / "7:30" -> "07:30", or null if it isn't a time
export function parseTime(text: string): string | null {
  const match = text.trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

// "adesso", "5 min fa", "3 h fa", "2 g fa", or a short date
export function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} g fa`;
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

// ---- Arrival in the city (users.relocated_at) ----

// Choices shown to the user; `months` is how long ago, used to store an approximate date
export const arrivalOptions = [
  { label: 'Questo mese', months: 0 },
  { label: '1–3 mesi fa', months: 2 },
  { label: '3–6 mesi fa', months: 4 },
  { label: '6–12 mesi fa', months: 9 },
  { label: 'Più di un anno fa', months: 18 },
];

// YYYY-MM-DD for "N months ago"
export function dateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function monthsSince(date: string): number {
  const then = new Date(date);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth());
}

// Index in arrivalOptions that best matches a stored date (for pre-selecting the chip)
export function arrivalOptionIndex(date: string | null): number | null {
  if (!date) return null;
  const months = monthsSince(date);
  if (months < 1) return 0;
  if (months <= 3) return 1;
  if (months <= 6) return 2;
  if (months <= 12) return 3;
  return 4;
}

// "In città da meno di un mese" / "In città da 3 mesi" / "In città da più di un anno"
export function arrivalLabel(date: string): string {
  const months = monthsSince(date);
  if (months < 1) return 'In città da meno di un mese';
  if (months === 1) return 'In città da 1 mese';
  if (months <= 12) return `In città da ${months} mesi`;
  return 'In città da più di un anno';
}
