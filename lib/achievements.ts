// Profile achievements ("traguardi"), computed from the user's activity.
// Pure functions: no storage needed, they unlock as soon as the data allows.
// Secret ones (easter egg) are hidden until unlocked; newAchievements() tells which ones are new
// since the last visit (remembered on this device), for the celebration on the profile.

import type { ProfileStats } from './types';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string; // how to unlock it
  unlocked: boolean;
  secret?: boolean; // hidden until unlocked
}

// The counts the achievements are made of: from your own stats (factsFromStats) or, for someone else,
// from public_profile (counts only, never which events)
export interface AchievementFacts {
  attended: number;
  organized: number;
  thanks_sent: number;
  thanks_received: number;
  passengers: number;
  groups: number;
  founder: boolean;
  morning: number; // events between 5 and 10
  night: number; // between 21 and 5
  after_midnight: number; // between 0 and 4
  trips: number;
  weekends: number;
  leap_day: boolean;
  max_series: number; // most times at the same recurring event
}

export function factsFromStats(stats: ProfileStats): AchievementFacts {
  const hours = stats.attended_events.map((e) => new Date(e.date_time).getHours());
  const perSeries = new Map<string, number>();
  for (const e of stats.attended_events) if (e.series_id) perSeries.set(e.series_id, (perSeries.get(e.series_id) ?? 0) + 1);
  return {
    attended: stats.attended,
    organized: stats.organized,
    thanks_sent: stats.thanks_sent,
    thanks_received: stats.thanks_received,
    passengers: stats.passengers,
    groups: stats.memberships.length,
    founder: stats.memberships.some((m) => m.member_role === 'admin'),
    morning: hours.filter((h) => h >= 5 && h < 10).length,
    night: hours.filter((h) => h >= 21 || h < 5).length,
    after_midnight: hours.filter((h) => h < 4).length,
    trips: stats.attended_events.filter((e) => e.kind === 'trip').length,
    weekends: stats.attended_events.filter((e) => [0, 6].includes(new Date(e.date_time).getDay())).length,
    leap_day: stats.attended_events.some((e) => {
      const d = new Date(e.date_time);
      return d.getMonth() === 1 && d.getDate() === 29;
    }),
    max_series: Math.max(0, ...perSeries.values()),
  };
}

export function computeAchievements(input: ProfileStats | AchievementFacts): Achievement[] {
  const f = 'attended_events' in input ? factsFromStats(input) : input;
  return [
    { id: 'first-event', emoji: '🎟️', name: 'Prima volta', description: 'Partecipa al tuo primo evento', unlocked: f.attended >= 1 },
    { id: 'organizer', emoji: '🗓️', name: 'Organizzatore', description: 'Organizza un evento', unlocked: f.organized >= 1 },
    { id: 'grateful', emoji: '🙏', name: 'Grazie mille', description: 'Ringrazia qualcuno per un evento', unlocked: f.thanks_sent >= 1 },
    { id: 'loved', emoji: '💛', name: 'Amato dal gruppo', description: 'Ricevi 5 grazie', unlocked: f.thanks_received >= 5 },
    { id: 'driver', emoji: '🚗', name: 'Autista', description: 'Porta un amico a un evento', unlocked: f.passengers >= 1 },
    { id: 'explorer', emoji: '🧭', name: 'Esploratore', description: 'Entra in 3 gruppi diversi', unlocked: f.groups >= 3 },
    { id: 'early-bird', emoji: '🌅', name: 'Mattiniero', description: 'Vai a un evento tra le 5 e le 10', unlocked: f.morning >= 1 },
    { id: 'night-owl', emoji: '🦉', name: 'Nottambulo', description: 'Vai a un evento tra le 21 e le 5', unlocked: f.night >= 1 },
    { id: 'steady', emoji: '🔥', name: 'Costanza', description: 'Partecipa a 10 eventi in totale', unlocked: f.attended >= 10 },
    { id: 'founder', emoji: '🏗️', name: 'Fondatore', description: 'Crea o gestisci un gruppo', unlocked: f.founder },
    // Secret
    {
      id: 'midnight', emoji: '🌙', name: 'Nottambulo d’élite', description: '3 eventi iniziati dopo mezzanotte', secret: true,
      unlocked: f.after_midnight >= 3,
    },
    { id: 'globetrotter', emoji: '🧳', name: 'Giramondo', description: '2 vacanze con i tuoi gruppi', secret: true, unlocked: f.trips >= 2 },
    { id: 'faithful', emoji: '💪', name: 'Fedelissimo', description: '5 volte allo stesso evento ricorrente', secret: true, unlocked: f.max_series >= 5 },
    { id: 'weekend', emoji: '🎈', name: 'Re del weekend', description: '5 eventi di sabato o domenica', secret: true, unlocked: f.weekends >= 5 },
    { id: 'leap', emoji: '🐸', name: 'Salto nel tempo', description: 'Un evento il 29 febbraio', secret: true, unlocked: f.leap_day },
  ];
}

const SEEN_KEY = 'huddle.unlockedAchievements';

// Achievements unlocked since the last time this device saw them (and remember them as seen).
// The first time ever, nothing is "new": it just remembers what's there.
export function newAchievements(achievements: Achievement[]): Achievement[] {
  const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
  try {
    const saved = globalThis.localStorage?.getItem(SEEN_KEY);
    globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(unlocked));
    if (saved === null || saved === undefined) return [];
    const seen = new Set<string>(JSON.parse(saved));
    return achievements.filter((a) => a.unlocked && !seen.has(a.id));
  } catch {
    return [];
  }
}
