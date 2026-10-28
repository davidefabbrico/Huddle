// Interests: categories with a pixel icon (components/PixelIcon.tsx), plus anything written by hand with
// "Altro". Stored as they are in users.interests, groups.tags and events.tags, and matched as they are:
// a category by its key ("sport"), a custom one in lowercase ("origami").
// `words` find the category in an event's title when it has no tags ("Calcetto del lunedì" -> sport).
// Keep the keys in sync with supabase/migrations/20261102_profilo_interessi_blocchi_gruppi.sql.

import type { PixelIconName } from '../components/PixelIcon';

export interface Interest {
  key: string;
  label: string;
  icon: PixelIconName;
  words: string[];
}

export const INTERESTS: Interest[] = [
  { key: 'sport', label: 'Sport', icon: 'sport', words: ['sport', 'calcio', 'calcetto', 'padel', 'tennis', 'running', 'corsa', 'basket', 'pallavolo', 'palestra', 'nuoto', 'arrampicata', 'partita'] },
  { key: 'musica', label: 'Musica', icon: 'music', words: ['musica', 'concerto', 'live', 'karaoke', 'band', 'jam session'] },
  { key: 'cinema', label: 'Cinema e serie', icon: 'cinema', words: ['cinema', 'film', 'serie tv', 'proiezione'] },
  { key: 'cibo', label: 'Cibo e aperitivi', icon: 'food', words: ['aperitivo', 'apericena', 'cena', 'pranzo', 'pizza', 'cucina', 'brunch', 'degustazione', 'vino', 'birra'] },
  { key: 'natura', label: 'Natura e trekking', icon: 'nature', words: ['natura', 'trekking', 'hiking', 'escursione', 'montagna', 'passeggiata', 'camminata'] },
  { key: 'viaggi', label: 'Viaggi', icon: 'travel', words: ['viaggio', 'gita', 'weekend fuori'] },
  { key: 'arte', label: 'Arte e cultura', icon: 'art', words: ['arte', 'mostra', 'museo', 'teatro', 'cultura'] },
  { key: 'libri', label: 'Libri', icon: 'books', words: ['libri', 'libro', 'lettura', 'book club'] },
  { key: 'giochi', label: 'Giochi da tavolo', icon: 'dice', words: ['giochi da tavolo', 'gioco da tavolo', 'board game', 'scacchi', 'quiz'] },
  { key: 'videogiochi', label: 'Videogiochi', icon: 'gamepad', words: ['videogioch', 'gaming', 'console', 'lan party'] },
  { key: 'tecnologia', label: 'Tecnologia', icon: 'laptop', words: ['tecnologia', 'coding', 'hackathon', 'startup'] },
  { key: 'lingue', label: 'Lingue', icon: 'globe', words: ['lingue', 'tandem', 'language exchange', 'inglese', 'spagnolo'] },
  { key: 'benessere', label: 'Benessere e yoga', icon: 'lotus', words: ['yoga', 'meditazione', 'pilates', 'benessere'] },
  { key: 'fotografia', label: 'Fotografia', icon: 'camera', words: ['fotografia', 'foto', 'photowalk'] },
  { key: 'feste', label: 'Feste e serate', icon: 'party', words: ['festa', 'party', 'serata', 'discoteca', 'ballo'] },
  { key: 'volontariato', label: 'Volontariato', icon: 'heart', words: ['volontariato', 'beneficenza', 'solidarietà'] },
];

const BY_KEY = new Map(INTERESTS.map((interest) => [interest.key, interest]));

export const MAX_CUSTOM_LENGTH = 30;

export const isCategory = (key: string) => BY_KEY.has(key);

// What to show: the category's name, or the custom interest with a capital letter
export function interestLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

// A category's icon; the tag for one written by hand
export function interestIcon(key: string): PixelIconName {
  return BY_KEY.get(key)?.icon ?? 'tag';
}

// An interest written with "Altro": trimmed, lowercase, short. If it names a category, that category.
export function cleanCustomInterest(text: string): string | null {
  const clean = text.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_CUSTOM_LENGTH);
  if (!clean) return null;
  return INTERESTS.find((i) => i.key === clean || i.label.toLowerCase() === clean)?.key ?? clean;
}

// The categories named in a text (an event's title)
export function categoriesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return INTERESTS.filter((interest) => interest.words.some((word) => lower.includes(word))).map((interest) => interest.key);
}
