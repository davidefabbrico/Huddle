// When an event counts as "live" and accepts check-ins.
// Keep in sync with the check-in window in supabase/schema.sql (event_attendees policies).

const HOUR = 60 * 60 * 1000;
export const CHECKIN_OPENS_BEFORE_MS = 1 * HOUR;
export const CHECKIN_CLOSES_AFTER_MS = 6 * HOUR;

export type EventPhase = 'upcoming' | 'live' | 'ended';

export const isInPast = (date: Date) => date.getTime() < Date.now();

// endsAt: holidays, the last day (live for the whole holiday)
export function eventPhase(dateTime: string, endsAt?: string | null, now = Date.now()): EventPhase {
  const start = new Date(dateTime).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start;
  if (now < start - CHECKIN_OPENS_BEFORE_MS) return 'upcoming';
  if (now <= end + CHECKIN_CLOSES_AFTER_MS) return 'live';
  return 'ended';
}
