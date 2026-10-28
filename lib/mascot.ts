// The group's mascot and its clan (easter eggs).
//   Mascot: a species the admin picks; it grows with the group's level (group_level: xp = people at
//   past events + 2 per event): egg -> cub -> young -> legend. Drawn in components/Mascot.tsx.
//   Clan: every group belongs to a clan of its mascot and of an element that comes from what the
//   group does (its topics, or its icon). Emblem, name and motto; the emblem gets rings as it levels up.
//   Seasonal hats: Halloween, Christmas, the group's birthday.
//   Legendary cards: the group's special moments, as collectible cards in its history.
//   Care (a tiny tamagotchi): the group feeds the mascot and plays with it; two bars that empty in a day.
//   It never dies: with empty bars it's only a bit sad.

import { GROUP_ICON_CATEGORIES } from './groupIcons';
import type { GroupHistory, GroupLevel, MascotSpecies } from './types';

export const SPECIES: { key: MascotSpecies; name: string; article: string }[] = [
  { key: 'fox', name: 'Volpe', article: 'della' },
  { key: 'cat', name: 'Gatto', article: 'del' },
  { key: 'panda', name: 'Panda', article: 'del' },
  { key: 'frog', name: 'Rana', article: 'della' },
  { key: 'penguin', name: 'Pinguino', article: 'del' },
  { key: 'dragon', name: 'Draghetto', article: 'del' },
];

export interface Stage {
  level: 0 | 1 | 2 | 3;
  name: string;
  minXp: number;
}

// Keep in sync with group_level in supabase/schema.sql (what xp counts)
export const STAGES: Stage[] = [
  { level: 0, name: 'Uovo', minXp: 0 },
  { level: 1, name: 'Cucciolo', minXp: 5 },
  { level: 2, name: 'Giovane', minXp: 25 },
  { level: 3, name: 'Leggenda', minXp: 80 },
];

export const stageFor = (xp: number): Stage => [...STAGES].reverse().find((s) => xp >= s.minXp) ?? STAGES[0];
export const nextStage = (xp: number): Stage | null => STAGES.find((s) => s.minXp > xp) ?? null;

const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);

// Without a choice, a species from the group's name (stable)
export function mascotOf(group: { name: string; mascot?: MascotSpecies | null }): MascotSpecies {
  return group.mascot ?? SPECIES[hash(group.name) % SPECIES.length].key;
}

// ---- Care (tamagotchi) ----

const CARE_HOURS = 24; // a full bar is empty a day later

// How full a bar is (0–1), from when the mascot last ate or played
export function careLevel(at: string | null, now = Date.now()): number {
  if (!at) return 0;
  return Math.max(0, Math.min(1, 1 - (now - new Date(at).getTime()) / (CARE_HOURS * 3600_000)));
}

// What the mascot says about how it's doing (null = it's fine: the usual greeting)
export function careWish(food: number, fun: number): string | null {
  if (food < 0.25 && fun < 0.25) return 'Ho fame e mi annoio… 🥺';
  if (food < 0.25) return 'Ho un po’ di fame… 🍎';
  if (fun < 0.25) return 'Giochiamo un po’? ⚽';
  return null;
}

// ---- Clan ----

export type Element = 'fuoco' | 'acqua' | 'vento' | 'terra' | 'fulmine';

export const ELEMENTS: Record<Element, { name: string; emoji: string; color: string; soft: string; motto: string }> = {
  fuoco: { name: 'Fuoco', emoji: '🔥', color: '#E8875F', soft: '#FFE3D6', motto: 'Dove arriviamo noi, si accende la festa.' },
  acqua: { name: 'Acqua', emoji: '🌊', color: '#5FA8D9', soft: '#DCEFFB', motto: 'Calmi in superficie, profondi dentro.' },
  vento: { name: 'Vento', emoji: '🍃', color: '#5DBE9A', soft: '#DBF3EA', motto: 'Sempre in movimento, mai fermi.' },
  terra: { name: 'Terra', emoji: '⛰️', color: '#B59A6B', soft: '#F1E8D8', motto: 'Solidi come la montagna.' },
  fulmine: { name: 'Fulmine', emoji: '⚡', color: '#E3B53B', soft: '#FFF2C7', motto: 'Veloci, carichi, inarrestabili.' },
};

// What the group does -> element (topics first, then the icon's category)
const TOPIC_ELEMENT: Record<string, Element> = {
  aperitivo: 'fuoco', cucina: 'fuoco', 'musica live': 'fuoco',
  yoga: 'acqua', cinema: 'acqua', fotografia: 'acqua',
  running: 'vento', hiking: 'vento',
  'giochi da tavolo': 'terra', libri: 'terra', lingue: 'terra',
  padel: 'fulmine',
};
const CATEGORY_ELEMENT: Record<string, Element> = {
  Sport: 'fulmine', 'Montagna e natura': 'vento', Cultura: 'acqua', Musica: 'fuoco',
  'Tecnologia e giochi': 'fulmine', 'Cibo e uscite': 'fuoco', Viaggi: 'vento', Altro: 'terra',
};

export function elementOf(group: { name: string; tags?: string[]; icon?: string | null }): Element {
  const counts = new Map<Element, number>();
  for (const tag of group.tags ?? []) {
    const element = TOPIC_ELEMENT[tag];
    if (element) counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  const category = GROUP_ICON_CATEGORIES.find((c) => group.icon && c.icons.includes(group.icon));
  if (category) return CATEGORY_ELEMENT[category.name];
  const all = Object.keys(ELEMENTS) as Element[];
  return all[hash(group.name) % all.length];
}

export function clanOf(group: { name: string; tags?: string[]; icon?: string | null; mascot?: MascotSpecies | null }) {
  const species = SPECIES.find((s) => s.key === mascotOf(group))!;
  const element = elementOf(group);
  return {
    element,
    name: `Clan ${species.article} ${species.name} di ${ELEMENTS[element].name}`,
    motto: ELEMENTS[element].motto,
  };
}

// ---- Seasonal hats (easter egg) ----

export type Hat = 'witch' | 'santa' | 'party' | null;

export function hatFor(groupCreatedAt: string | null, now = new Date()): Hat {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (groupCreatedAt) {
    const born = new Date(groupCreatedAt);
    const yearsOld = now.getFullYear() - born.getFullYear();
    if (yearsOld >= 1 && born.getMonth() + 1 === m && born.getDate() === d) return 'party'; // the group's birthday
  }
  if ((m === 10 && d >= 25) || (m === 11 && d <= 2)) return 'witch';
  if ((m === 12 && d >= 15) || (m === 1 && d <= 6)) return 'santa';
  return null;
}

// ---- Legendary cards (easter egg, in the group's history) ----

export type Rarity = 'comune' | 'rara' | 'epica' | 'leggendaria';

export interface LegendCard {
  id: string;
  emoji: string;
  title: string;
  hint: string; // how to unlock it (shown while locked)
  rarity: Rarity;
  unlockedAt: string | null; // ISO date, null = still locked
}

export function legendCards(history: GroupHistory, level: GroupLevel): LegendCard[] {
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
      id: 'legend', emoji: '👑', title: 'La mascotte leggendaria', hint: 'Fate crescere la mascotte fino in fondo', rarity: 'leggendaria',
      unlockedAt: stageFor(level.xp).level === 3 ? new Date().toISOString() : null,
    },
  ];
}
