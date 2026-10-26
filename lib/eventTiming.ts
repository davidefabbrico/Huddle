// When an event counts as "live" and accepts check-ins.
// Keep in sync with the check-in window in supabase/schema.sql (event_attendees policies).

const HOUR = 60 * 60 * 1000;
export const CHECKIN_OPENS_BEFORE_MS = 1 * HOUR;
export const CHECKIN_CLOSES_AFTER_MS = 6 * HOUR;

export type EventPhase = 'upcoming' | 'live' | 'ended';

export const isInPast = (date: Date) => date.getTime() < Date.now();

export function eventPhase(dateTime: string, now = Date.now()): EventPhase {
  const start = new Date(dateTime).getTime();
  if (now < start - CHECKIN_OPENS_BEFORE_MS) return 'upcoming';
  if (now <= start + CHECKIN_CLOSES_AFTER_MS) return 'live';
  return 'ended';
}
