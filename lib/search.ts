// Search filters for events and groups: text, distance from your area, age, interests.
// Everything runs on the lists already loaded (the town's groups and upcoming events).

import { MAX_AGE, MIN_AGE } from './age';
import { distanceMeters, type LatLon } from './geo';
import { eventTopics } from './recommendations';
import type { EventWithGroup, Group } from './types';

// The ages chosen with the slider (from–to); the whole range means "any age"
export interface AgeRange {
  min: number;
  max: number;
}

export const ANY_AGE: AgeRange = { min: MIN_AGE, max: MAX_AGE };
export const isAnyAge = (age: AgeRange) => age.min <= MIN_AGE && age.max >= MAX_AGE;

export const DISTANCES_KM = [5, 10, 25, 50];

export interface SearchFilters {
  text: string;
  maxKm: number | null; // null = anywhere
  origin: LatLon | null; // your area (or your position, once)
  age: AgeRange; // groups whose age range overlaps it (groups without a range always match)
  interests: string[]; // any of them
}

export const ageFromBirthYear = (year: number) => new Date().getFullYear() - year;

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function matchesText(fields: (string | null | undefined)[], text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
}

function ageOverlaps(min: number | null, max: number | null, age: AgeRange): boolean {
  if (isAnyAge(age)) return true;
  return (min ?? 0) <= age.max && (max ?? 200) >= age.min;
}

// Distance in km, or null without coordinates
export function kmFrom(origin: LatLon | null, place: { lat: number | null; lon: number | null }): number | null {
  if (!origin || place.lat == null || place.lon == null) return null;
  return distanceMeters(origin, { lat: place.lat, lon: place.lon }) / 1000;
}

function withinDistance(filters: SearchFilters, place: { lat: number | null; lon: number | null }): boolean {
  if (filters.maxKm == null) return true;
  const km = kmFrom(filters.origin, place);
  return km != null && km <= filters.maxKm;
}

export function filterGroups<T extends Group>(groups: T[], filters: SearchFilters): T[] {
  return groups.filter(
    (g) =>
      matchesText([g.name, g.description, g.location, ...g.tags], filters.text) &&
      withinDistance(filters, g) &&
      ageOverlaps(g.age_min, g.age_max, filters.age) &&
      (!filters.interests.length || filters.interests.some((i) => g.tags.includes(i) || normalize(`${g.name} ${g.description}`).includes(i))),
  );
}

export function filterEvents(events: EventWithGroup[], filters: SearchFilters): EventWithGroup[] {
  return events.filter(
    (e) =>
      matchesText([e.title, e.location, e.group_name, ...e.tags], filters.text) &&
      withinDistance(filters, e) &&
      ageOverlaps(e.group_age_min, e.group_age_max, filters.age) &&
      (!filters.interests.length || filters.interests.some((i) => eventTopics(e).includes(i))),
  );
}

// "25–35 anni" / "dai 30 anni" / "fino a 25 anni"
export function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${min}–${max} anni`;
  if (min != null) return `dai ${min} anni`;
  if (max != null) return `fino a ${max} anni`;
  return null;
}
