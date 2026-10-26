// Group "photo": an emoji on a colored tile, chosen only from these lists (like app icons on a phone).
// The database accepts only these values too: keep supabase/schema.sql (groups.icon / groups.color checks)
// and supabase/migrations/20261027_group_icons.sql in sync when you change them.
// Single emoji only (no skin tones or combined sequences): they look the same on iPhone, Android and desktop.

export const GROUP_ICON_CATEGORIES: { name: string; icons: string[] }[] = [
  { name: 'Sport', icons: ['⚽', '🏀', '🏐', '🎾', '🏓', '🏸', '⛳', '🥊', '⛷️', '🏂', '🚴', '🏃', '🧗', '🏊', '🧘', '🏋️', '🛹', '🛶'] },
  { name: 'Montagna e natura', icons: ['⛰️', '🥾', '🏕️', '🌊', '🌿', '🌻', '🐶', '🐱', '🎣', '🚲'] },
  { name: 'Cultura', icons: ['📚', '✍️', '🎭', '🎨', '🎬', '📷', '🏛️', '🗣️', '🧠', '🌍'] },
  { name: 'Musica', icons: ['🎧', '🎸', '🎹', '🎤', '🥁', '🎷', '🎻', '🎶'] },
  { name: 'Tecnologia e giochi', icons: ['💻', '📱', '🤖', '🎮', '🎲', '♟️', '🧩', '🚀'] },
  { name: 'Cibo e uscite', icons: ['🍕', '🍝', '🍣', '🍔', '☕', '🍷', '🍻', '🥂', '🍰', '🍳'] },
  { name: 'Viaggi', icons: ['✈️', '🚗', '🚆', '🏖️', '🗺️', '🏙️'] },
  { name: 'Altro', icons: ['👥', '💬', '❤️', '🎉', '⭐', '🌈', '🔥', '🍀'] },
];

export const GROUP_ICONS = GROUP_ICON_CATEGORIES.flatMap((c) => c.icons);

// Tile background (soft, so the emoji stands out) and the swatch shown in the color picker.
// Full class names so Tailwind finds them.
export const GROUP_COLORS = {
  orange: { tile: 'bg-orange-100', swatch: 'bg-orange-300', label: 'Arancio' },
  rose: { tile: 'bg-rose-100', swatch: 'bg-rose-300', label: 'Rosa' },
  violet: { tile: 'bg-violet-100', swatch: 'bg-violet-300', label: 'Viola' },
  sky: { tile: 'bg-sky-100', swatch: 'bg-sky-300', label: 'Azzurro' },
  teal: { tile: 'bg-teal-100', swatch: 'bg-teal-300', label: 'Verde acqua' },
  green: { tile: 'bg-emerald-100', swatch: 'bg-emerald-300', label: 'Verde' },
  amber: { tile: 'bg-amber-100', swatch: 'bg-amber-300', label: 'Giallo' },
  slate: { tile: 'bg-stone-200', swatch: 'bg-stone-400', label: 'Grigio' },
} as const;

export type GroupColor = keyof typeof GROUP_COLORS;
export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColor[];

export const isGroupIcon = (icon: string | null | undefined): icon is string => !!icon && GROUP_ICONS.includes(icon);
export const isGroupColor = (color: string | null | undefined): color is GroupColor => !!color && color in GROUP_COLORS;

// A sensible icon from the group's name, used until someone picks one (and for older groups)
const suggestions: [RegExp, string][] = [
  [/calc(io|etto)|football|soccer/i, '⚽'],
  [/basket/i, '🏀'],
  [/volley|pallavolo/i, '🏐'],
  [/padel|tennis/i, '🎾'],
  [/\bsci\b|sciare|neve|ski/i, '⛷️'],
  [/snowboard/i, '🏂'],
  [/bici|cicl|bike/i, '🚴'],
  [/corsa|run|maratona/i, '🏃'],
  [/arrampic|climb|bouldering/i, '🧗'],
  [/nuoto|swim|piscina/i, '🏊'],
  [/yoga|medita/i, '🧘'],
  [/palestra|gym|fitness/i, '🏋️'],
  [/hik|trek|escursion|montagna|cammin/i, '🥾'],
  [/libr|book|lettur|leggere/i, '📚'],
  [/teatro/i, '🎭'],
  [/cinema|film/i, '🎬'],
  [/foto/i, '📷'],
  [/lingu|language|conversa/i, '🗣️'],
  [/music|band|concert|dj/i, '🎧'],
  [/chitarr/i, '🎸'],
  [/coro|cantare|karaoke/i, '🎤'],
  [/tech|coding|program|informatic|developer|dev\b/i, '💻'],
  [/videogioc|gaming|game/i, '🎮'],
  [/gioc|board|tavolo/i, '🎲'],
  [/scacchi|chess/i, '♟️'],
  [/pizza/i, '🍕'],
  [/cucina|cena|food|pranzo/i, '🍝'],
  [/sushi/i, '🍣'],
  [/caff[eè]|colazione|brunch/i, '☕'],
  [/aperitiv|vino|wine/i, '🍷'],
  [/birra|beer|pub/i, '🍻'],
  [/viagg|travel/i, '✈️'],
  [/mare|spiaggia|surf/i, '🌊'],
  [/cane|cani|dog/i, '🐶'],
];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function suggestGroupIcon(name: string): { icon: string; color: GroupColor } {
  const icon = suggestions.find(([pattern]) => pattern.test(name))?.[1] ?? '👥';
  return { icon, color: GROUP_COLOR_KEYS[hash(name.trim().toLowerCase()) % GROUP_COLOR_KEYS.length] };
}

// What to show for a group: its chosen icon/color, or the suggestion from its name
export function groupLook(group: { name: string; icon?: string | null; color?: string | null }): { icon: string; color: GroupColor } {
  const suggestion = suggestGroupIcon(group.name);
  return {
    icon: isGroupIcon(group.icon) ? group.icon : suggestion.icon,
    color: isGroupColor(group.color) ? group.color : suggestion.color,
  };
}
