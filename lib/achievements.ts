// Profile achievements ("traguardi"), computed from the user's activity.
// Pure functions: no storage needed, they unlock as soon as the data allows.

import type { ProfileStats } from './types';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string; // how to unlock it
  unlocked: boolean;
}

export function computeAchievements(stats: ProfileStats): Achievement[] {
  const hours = stats.attended_events.map((e) => new Date(e.date_time).getHours());
  const isFounder = stats.memberships.some((m) => m.member_role === 'admin');

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
  ];
}
