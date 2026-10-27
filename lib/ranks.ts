// Rank ladder inside a group, from newcomer to legend.
// The rank depends on how many of the group's events you attended (event_attendees.checked_in).
// Names are gender-neutral on purpose.

export interface Rank {
  level: number;
  name: string;
  emoji: string;
  minEvents: number; // attended events needed to reach this rank
  description: string;
}

export const RANKS: Rank[] = [
  { level: 1, name: 'Volto nuovo', emoji: '🌱', minEvents: 0, description: 'Hai appena messo piede nel gruppo: si parte!' },
  { level: 2, name: 'Faccia nota', emoji: '👋', minEvents: 1, description: 'Ti hanno visto a un evento: iniziano a ricordarsi il tuo nome.' },
  { level: 3, name: 'Prezzemolo', emoji: '🌿', minEvents: 3, description: 'Ci sei sempre, come il prezzemolo.' },
  { level: 4, name: 'Anima della festa', emoji: '🎉', minEvents: 6, description: 'Se manchi tu, la serata non parte.' },
  { level: 5, name: 'Colonna portante', emoji: '🏛️', minEvents: 10, description: 'Il gruppo si regge anche su di te.' },
  { level: 6, name: 'Leggenda vivente', emoji: '👑', minEvents: 15, description: 'Raccontano storie su di te ai nuovi arrivati.' },
];

export function rankFor(attendedEvents: number): Rank {
  return [...RANKS].reverse().find((r) => attendedEvents >= r.minEvents) ?? RANKS[0];
}

// Next rank and how many events are missing, or null at the top
export function nextRank(attendedEvents: number): { rank: Rank; missing: number } | null {
  const next = RANKS.find((r) => r.minEvents > attendedEvents);
  return next ? { rank: next, missing: next.minEvents - attendedEvents } : null;
}

// 0..1 progress toward the next rank, counted from zero (1 of 3 events = one third)
export function rankProgress(attendedEvents: number): number {
  const next = nextRank(attendedEvents);
  return next ? attendedEvents / next.rank.minEvents : 1;
}
