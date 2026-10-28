// "Per te": suggested events, with a transparent weighted score (no machine learning).
//   score = interest × your interests and the events you went to (content)
//         + groupTaste × what the people in your groups like (collaborative: gets you out of your bubble)
//         + mates × how many people from your groups are going
//         + similar × how many people with your interests are going
//         + newcomer × for people new in town: groups open to new members, other newcomers going
//         + soon × how close it is
// Every suggestion explains itself in one line. One slot is "Fuori dal solito": something your groups
// like that doesn't match your interests. Signals are counts from the database, never names.

import { distanceMeters } from './geo';
import { categoriesIn, interestLabel } from './interests';
import type { EventAttendee, EventWithGroup, ForYouSignals, Group, User, UserSettings } from './types';

export const WEIGHTS = {
  interest: 3,
  groupTaste: 2,
  mates: 2,
  similar: 1,
  newcomer: 1.5,
  soon: 0.5,
};

const MAX_SUGGESTIONS = 12;
const OUTSIDE_SLOT = 2; // position of "Fuori dal solito" in the list (0-based)
const DAY_MS = 24 * 3600e3;

export interface Suggestion {
  event: EventWithGroup;
  score: number;
  reason: string; // "Ti piace il padel · ci vanno 3 persone dei tuoi gruppi"
  outside: boolean; // "Fuori dal solito"
}

// The event's tags, plus the categories named in its title (for events without tags)
export function eventTopics(event: Pick<EventWithGroup, 'title' | 'tags'>): string[] {
  return [...new Set([...event.tags, ...categoriesIn(event.title)])];
}

// An interest as a reason: "cinema e serie"
const named = (key: string) => interestLabel(key).toLowerCase();

const people = (n: number, what: string) => (n === 1 ? `ci va 1 persona ${what}` : `ci vanno ${n} persone ${what}`);

export function recommendEvents(
  events: EventWithGroup[],
  me: Pick<User, 'id' | 'interests' | 'is_relocated'>,
  answers: Record<string, EventAttendee>,
  myGroupIds: Set<string>,
  signals: ForYouSignals,
  now = Date.now(),
): Suggestion[] {
  const counts = new Map(signals.events.map((s) => [s.event_id, s]));
  const myInterests = new Set(me.interests);
  const maxTaste = Math.max(1, ...Object.values(signals.taste));

  const seenSeries = new Set<string>();
  const scored = [...events]
    .sort((a, b) => a.date_time.localeCompare(b.date_time))
    // Still to decide: upcoming and not answered yet; for a recurring event only the next date
    .filter((event) => {
      if (new Date(event.date_time).getTime() <= now || answers[event.id] || event.cancelled_at) return false;
      if (!event.series_id) return true;
      if (seenSeries.has(event.series_id)) return false;
      seenSeries.add(event.series_id);
      return true;
    })
    .map((event) => {
      const topics = eventTopics(event);
      const liked = topics.find((t) => myInterests.has(t));
      const wentBefore = topics.find((t) => signals.mine[t]);
      const groupFavorite = [...topics].sort((a, b) => (signals.taste[b] ?? 0) - (signals.taste[a] ?? 0))[0];
      const c = counts.get(event.id) ?? { mates_going: 0, similar_going: 0, newcomers_going: 0 };
      const days = (new Date(event.date_time).getTime() - now) / DAY_MS;
      const openToMe = me.is_relocated && event.group_type === 'open_to_new' && !myGroupIds.has(event.group_id);

      const parts = {
        interest: liked ? 1 : wentBefore ? 0.6 : 0,
        groupTaste: groupFavorite ? (signals.taste[groupFavorite] ?? 0) / maxTaste : 0,
        mates: Math.min(1, c.mates_going / 3),
        similar: Math.min(1, c.similar_going / 3),
        newcomer: me.is_relocated ? (openToMe ? 0.5 : 0) + Math.min(0.5, c.newcomers_going / 4) : 0,
        soon: days < 3 ? 1 : days < 7 ? 0.5 : 0,
      };
      const score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((sum, k) => sum + WEIGHTS[k] * parts[k], 0);

      // The reason: the strongest signals, in plain words (at most two)
      const reasons: [number, string][] = [];
      if (liked) reasons.push([WEIGHTS.interest, `ti piace: ${named(liked)}`]);
      else if (wentBefore) reasons.push([WEIGHTS.interest * 0.6, `simile a eventi dove sei stato/a (${named(wentBefore)})`]);
      if (parts.mates > 0) reasons.push([WEIGHTS.mates * parts.mates + 0.1, people(c.mates_going, 'dei tuoi gruppi')]);
      if (parts.groupTaste > 0 && groupFavorite !== liked) {
        reasons.push([WEIGHTS.groupTaste * parts.groupTaste, `${interestLabel(groupFavorite)} piace ai tuoi gruppi`]);
      }
      if (parts.similar > 0) reasons.push([WEIGHTS.similar * parts.similar, people(c.similar_going, 'con i tuoi interessi')]);
      if (openToMe) reasons.push([WEIGHTS.newcomer * 0.5, 'il gruppo accoglie persone nuove']);
      if (me.is_relocated && c.newcomers_going > 0) reasons.push([WEIGHTS.newcomer * 0.4, people(c.newcomers_going, 'nuove in città')]);
      const line = reasons.sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, text]) => text);
      const reason = line.length ? line.join(' · ') : days < 3 ? 'tra pochi giorni' : 'da scoprire';

      return {
        event,
        score,
        reason: reason.charAt(0).toUpperCase() + reason.slice(1),
        outside: !parts.interest && (parts.groupTaste > 0 || parts.mates > 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.event.date_time.localeCompare(b.event.date_time));

  // Cold start (no signals at all): the next events, by date
  if (scored.every((s) => s.score <= WEIGHTS.soon)) {
    return scored
      .sort((a, b) => a.event.date_time.localeCompare(b.event.date_time))
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => ({ ...s, outside: false }));
  }

  // "Fuori dal solito": the best one your groups like but outside your interests, if it didn't make the top
  const top = scored.slice(0, MAX_SUGGESTIONS).map((s) => ({ ...s, outside: false }));
  const outside = scored.find((s) => s.outside);
  if (outside) {
    const rest = top.filter((s) => s.event.id !== outside.event.id).slice(0, MAX_SUGGESTIONS - 1);
    rest.splice(Math.min(OUTSIDE_SLOT, rest.length), 0, outside);
    return rest;
  }
  return top;
}

// Weekly newsletter ("La tua settimana", top of "Per te"): up to 5 events of the next 7 days you
// haven't answered, near your area or matching your interests. Same rule as newsletter_digest in
// schema.sql, which also puts it in Attività once a week.
export interface WeeklyPick {
  event: EventWithGroup;
  why: string; // "a 2,3 km" / "ti piace: cinema"
}

export function weeklyPicks(
  events: EventWithGroup[],
  me: Pick<User, 'interests'>,
  answers: Record<string, EventAttendee>,
  settings: UserSettings,
  now = Date.now(),
): WeeklyPick[] {
  const area = settings.area_lat != null && settings.area_lon != null ? { lat: settings.area_lat, lon: settings.area_lon } : null;
  const seenSeries = new Set<string>();
  const picks: WeeklyPick[] = [];
  for (const event of [...events].sort((a, b) => a.date_time.localeCompare(b.date_time))) {
    const start = new Date(event.date_time).getTime();
    if (start <= now || start > now + 7 * 24 * 3600e3 || answers[event.id] || event.cancelled_at) continue;
    if (event.series_id && seenSeries.has(event.series_id)) continue;
    const km = area && event.lat != null && event.lon != null ? distanceMeters(area, { lat: event.lat, lon: event.lon }) / 1000 : null;
    const liked = event.tags.find((t) => me.interests.includes(t));
    if (!liked && (km == null || km > settings.search_radius_km)) continue;
    if (event.series_id) seenSeries.add(event.series_id);
    picks.push({ event, why: km != null && km <= settings.search_radius_km ? `a ${km.toFixed(1).replace('.', ',')} km` : `ti piace: ${named(liked!)}` });
    if (picks.length === 5) break;
  }
  return picks;
}

// "Per te" groups (home, right after the onboarding): the groups you're not in that are into what you
// like, the ones sharing more of your interests first, then the ones open to new members
export interface GroupSuggestion<G> {
  group: G;
  reason: string; // "ti piace: sport, musica"
}

export function recommendGroups<G extends Pick<Group, 'id' | 'tags' | 'type'>>(
  groups: G[],
  me: Pick<User, 'interests'>,
  myGroupIds: Set<string>,
): GroupSuggestion<G>[] {
  const mine = new Set(me.interests);
  return groups
    .filter((group) => !myGroupIds.has(group.id))
    .map((group) => ({ group, shared: group.tags.filter((tag) => mine.has(tag)) }))
    .filter(({ shared }) => shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || (a.group.type === 'open_to_new' ? -1 : 0) - (b.group.type === 'open_to_new' ? -1 : 0))
    .map(({ group, shared }) => ({ group, reason: `ti piace: ${shared.map(named).join(', ')}` }));
}
