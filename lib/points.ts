// Points: what you earn by taking part. Shown on the profile and in each group's leaderboard.

import type { PointsBreakdown } from './types';

export const POINTS = {
  organize: 10, // per event you organized, once it has started (not the dates of a recurring event)
  attend: 5, // per event you attended (check-in, or "Ci sono" and it started)
  thanksReceived: 2, // per "grazie" received
  passenger: 5, // per person who came to an event in your car
};

// Venues and businesses earn differently (they organize as a job). Keep in sync with earned_points in schema.sql.
export const BUSINESS_POINTS = {
  organize: 5,
  participant: 2, // per person at your events
  thanksReceived: 2,
};

// Points a venue spends to send an event to the groups in the area (promote_event)
export const PROMOTION_COST = 20;

export const businessPointsRules = [
  { emoji: '🗓️', label: 'Organizzi un evento', points: BUSINESS_POINTS.organize },
  { emoji: '🙋', label: 'Ogni persona che viene', points: BUSINESS_POINTS.participant },
  { emoji: '🙏', label: 'Ricevi un grazie', points: BUSINESS_POINTS.thanksReceived },
];

// The rules, as shown to users
export const pointsRules = [
  { emoji: '🗓️', label: 'Organizzi un evento', points: POINTS.organize },
  { emoji: '🙌', label: 'Partecipi a un evento', points: POINTS.attend },
  { emoji: '🙏', label: 'Ricevi un grazie', points: POINTS.thanksReceived },
  { emoji: '🚗', label: 'Dai un passaggio (per passeggero)', points: POINTS.passenger },
];

export function pointsBreakdown(organized: number, attended: number, thanksReceived: number, passengers: number): PointsBreakdown {
  return {
    organized,
    attended,
    thanks_received: thanksReceived,
    passengers,
    points:
      organized * POINTS.organize +
      attended * POINTS.attend +
      thanksReceived * POINTS.thanksReceived +
      passengers * POINTS.passenger,
  };
}

// An answer counts as attendance if you checked in, or said "Ci sono" and the event has started
export function isAttended(row: { status: string; checked_in: boolean }, eventDateTime: string, now = Date.now()): boolean {
  return row.checked_in || (row.status === 'going' && new Date(eventDateTime).getTime() <= now);
}
