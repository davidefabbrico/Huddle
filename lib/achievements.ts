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
  const hours = stats.checked_in_events.map((e) => new Date(e.date_time).getHours());
  const groupsJoined = stats.memberships.length;
  const isFounder = stats.memberships.some((m) => m.member_role === 'admin');

  return [
    { id: 'first-event', emoji: '🎟️', name: 'Prima volta', description: 'Fai check-in al tuo primo evento', unlocked: hours.length >= 1 },
    { id: 'icebreaker', emoji: '🧊', name: 'Rompighiaccio', description: 'Scrivi il primo messaggio in una chat', unlocked: stats.message_count >= 1 },
    { id: 'explorer', emoji: '🧭', name: 'Esploratore', description: 'Entra in 3 gruppi diversi', unlocked: groupsJoined >= 3 },
    { id: 'early-bird', emoji: '🌅', name: 'Mattiniero', description: 'Check-in a un evento tra le 5 e le 10', unlocked: hours.some((h) => h >= 5 && h < 10) },
    { id: 'night-owl', emoji: '🦉', name: 'Nottambulo', description: 'Check-in a un evento tra le 21 e le 5', unlocked: hours.some((h) => h >= 21 || h < 5) },
    { id: 'steady', emoji: '🔥', name: 'Costanza', description: 'Partecipa a 10 eventi in totale', unlocked: hours.length >= 10 },
    { id: 'founder', emoji: '🏗️', name: 'Fondatore', description: 'Crea o gestisci un gruppo', unlocked: isFounder },
  ];
}
