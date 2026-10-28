// Profile achievements ("traguardi"), computed from the user's activity.
// Pure functions: no storage needed, they unlock as soon as the data allows.
// Secret ones (easter egg) show as "???" until unlocked; newAchievements() tells which ones are new
// since the last visit (remembered on this device), for the celebration on the profile.

import type { ProfileStats } from './types';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string; // how to unlock it
  unlocked: boolean;
  secret?: boolean; // hidden ("???") until unlocked
}

export function computeAchievements(stats: ProfileStats): Achievement[] {
  const hours = stats.attended_events.map((e) => new Date(e.date_time).getHours());
  const isFounder = stats.memberships.some((m) => m.member_role === 'admin');
  const trips = stats.attended_events.filter((e) => e.kind === 'trip').length;
  const weekends = stats.attended_events.filter((e) => [0, 6].includes(new Date(e.date_time).getDay())).length;
  const leapDay = stats.attended_events.some((e) => {
    const d = new Date(e.date_time);
    return d.getMonth() === 1 && d.getDate() === 29;
  });
  const perSeries = new Map<string, number>();
  for (const e of stats.attended_events) if (e.series_id) perSeries.set(e.series_id, (perSeries.get(e.series_id) ?? 0) + 1);
  const seriesCounts = [...perSeries.values()];

  return [
    { id: 'first-event', emoji: '🎟️', name: 'Prima volta', description: 'Partecipa al tuo primo evento', unlocked: stats.attended >= 1 },
    { id: 'organizer', emoji: '🗓️', name: 'Organizzatore', description: 'Organizza un evento', unlocked: stats.organized >= 1 },
    { id: 'grateful', emoji: '🙏', name: 'Grazie mille', description: 'Ringrazia qualcuno per un evento', unlocked: stats.thanks_sent >= 1 },
    { id: 'loved', emoji: '💛', name: 'Amato dal gruppo', description: 'Ricevi 5 grazie', unlocked: stats.thanks_received >= 5 },
    { id: 'driver', emoji: '🚗', name: 'Autista', description: 'Porta un amico a un evento', unlocked: stats.passengers >= 1 },
    { id: 'explorer', emoji: '🧭', name: 'Esploratore', description: 'Entra in 3 gruppi diversi', unlocked: stats.memberships.length >= 3 },
    { id: 'early-bird', emoji: '🌅', name: 'Mattiniero', description: 'Vai a un evento tra le 5 e le 10', unlocked: hours.some((h) => h >= 5 && h < 10) },
    { id: 'night-owl', emoji: '🦉', name: 'Nottambulo', description: 'Vai a un evento tra le 21 e le 5', unlocked: hours.some((h) => h >= 21 || h < 5) },
    { id: 'steady', emoji: '🔥', name: 'Costanza', description: 'Partecipa a 10 eventi in totale', unlocked: stats.attended >= 10 },
    { id: 'founder', emoji: '🏗️', name: 'Fondatore', description: 'Crea o gestisci un gruppo', unlocked: isFounder },
    // Secret
    {
      id: 'midnight', emoji: '🌙', name: 'Nottambulo d’élite', description: '3 eventi iniziati dopo mezzanotte', secret: true,
      unlocked: hours.filter((h) => h < 4).length >= 3,
    },
    { id: 'globetrotter', emoji: '🧳', name: 'Giramondo', description: '2 vacanze con i tuoi gruppi', secret: true, unlocked: trips >= 2 },
    { id: 'faithful', emoji: '💪', name: 'Fedelissimo', description: '5 volte allo stesso evento ricorrente', secret: true, unlocked: Math.max(0, ...seriesCounts) >= 5 },
    { id: 'weekend', emoji: '🎈', name: 'Re del weekend', description: '5 eventi di sabato o domenica', secret: true, unlocked: weekends >= 5 },
    { id: 'leap', emoji: '🐸', name: 'Salto nel tempo', description: 'Un evento il 29 febbraio', secret: true, unlocked: leapDay },
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
