// Legendary cards (easter egg, in the group's history, uncovered by tapping its summary): the group's
// special moments as collectible cards, common to legendary.

import type { GroupHistory } from './types';

const LEGEND_XP = 80;

// The group's experience: people at its past events, plus 2 per event
function experience(history: GroupHistory): number {
  return history.events.reduce((sum, e) => sum + e.going + 2, 0);
}

export type Rarity = 'comune' | 'rara' | 'epica' | 'leggendaria';

export interface LegendCard {
  id: string;
  emoji: string;
  title: string;
  hint: string; // how to unlock it (shown while locked)
  rarity: Rarity;
  unlockedAt: string | null; // ISO date, null = still locked
}

export function legendCards(history: GroupHistory): LegendCard[] {
  const events = history.events.filter((e) => e.kind === 'event');
  const trips = history.events.filter((e) => e.kind === 'trip');
  // the date of the n-th attendance overall
  let running = 0;
  let fiftieth: string | null = null;
  for (const e of history.events) {
    running += e.going;
    if (!fiftieth && running >= 50) fiftieth = e.date_time;
  }
  const yearOld = new Date(history.created_at);
  yearOld.setFullYear(yearOld.getFullYear() + 1);
  const full = history.events.find((e) => e.going >= history.members.length + 1 && history.members.length >= 3);
  const withPhotos = history.events.find((e) => e.photos.length >= 5);
  return [
    { id: 'born', emoji: '🐣', title: 'La nascita', hint: '', rarity: 'comune', unlockedAt: history.created_at },
    { id: 'first', emoji: '🎈', title: 'Il primo evento', hint: 'Fate il primo evento', rarity: 'comune', unlockedAt: events[0]?.date_time ?? null },
    { id: 'ten', emoji: '🔟', title: 'Dieci volte insieme', hint: 'Arrivate a 10 eventi', rarity: 'rara', unlockedAt: events[9]?.date_time ?? null },
    { id: 'trip', emoji: '🧳', title: 'La prima vacanza', hint: 'Partite insieme', rarity: 'rara', unlockedAt: trips[0]?.date_time ?? null },
    { id: 'all', emoji: '🫶', title: 'Tutti presenti', hint: 'Un evento con tutto il gruppo', rarity: 'epica', unlockedAt: full?.date_time ?? null },
    { id: 'album', emoji: '📸', title: 'L’album', hint: '5 foto in un solo evento', rarity: 'epica', unlockedAt: withPhotos?.date_time ?? null },
    { id: 'fifty', emoji: '🏟️', title: 'Cinquanta presenze', hint: '50 presenze in tutto', rarity: 'epica', unlockedAt: fiftieth },
    {
      id: 'year', emoji: '🎂', title: 'Un anno insieme', hint: 'Festeggiate il primo compleanno', rarity: 'leggendaria',
      unlockedAt: yearOld.getTime() <= Date.now() ? yearOld.toISOString() : null,
    },
    {
      id: 'legend', emoji: '👑', title: 'Il gruppo leggendario', hint: 'Arrivate a 80 punti esperienza', rarity: 'leggendaria',
      unlockedAt: experience(history) >= LEGEND_XP ? new Date().toISOString() : null,
    },
  ];
}
