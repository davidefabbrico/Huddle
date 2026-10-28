// Small display helpers shared by screens and components (Italian locale)

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

// ---- Calendar days and holidays ----

// Local day as "YYYY-MM-DD" (calendar keys, holiday plan days)
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// "YYYY-MM-DD" -> local midnight
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Every day from start to end (holidays span several days in the calendar)
export function dayKeysBetween(startIso: string, endIso?: string | null): string[] {
  const day = new Date(startIso);
  day.setHours(0, 0, 0, 0);
  const last = endIso ? new Date(endIso) : new Date(day); // a copy: `day` moves forward
  const keys: string[] = [];
  while (day <= last && keys.length < 62) {
    keys.push(dayKey(day));
    day.setDate(day.getDate() + 1);
  }
  return keys;
}

// "12 ott 2026"
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

// "ottobre 2026"
export function monthLabel(date: Date): string {
  return date.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

// "gio 12 ago" for a "YYYY-MM-DD" key
export function shortDayLabel(key: string): string {
  return fromDayKey(key).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Holiday dates: "12 – 16 ago" / "30 ott – 2 nov"
export function tripDatesLabel(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const month = (d: Date) => d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '');
  if (dayKey(start) === dayKey(end)) return `${start.getDate()} ${month(start)}`;
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

// ---- Money (shared expenses, euro cents) ----

// 1250 -> "12,50 €"
export function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

// "12,50" / "12.5" / "12" -> 1250, or null if it isn't an amount
export function parseEuro(text: string): number | null {
  const match = text.trim().replace('€', '').trim().match(/^(\d{1,6})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

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
