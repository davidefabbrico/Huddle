// Address search with OpenStreetMap Nominatim (the same service SmartPark uses).
// Usage policy: at most ~1 request per second (callers debounce), results shown with attribution.

import type { LatLon } from './geo';

export interface Place extends LatLon {
  label: string; // short: "Via Pascal 12, Città Studi, Milano"
  full: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=it&q=';

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const response = await fetch(NOMINATIM + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const rows: { lat: string; lon: string; display_name: string }[] = await response.json();
  return rows.map((r) => ({
    lat: Number(r.lat),
    lon: Number(r.lon),
    full: r.display_name,
    label: r.display_name.split(',').slice(0, 3).join(',').trim(),
  }));
}

// Best guess for a free-text location (events created without picking a suggestion)
export async function geocodeFirst(query: string): Promise<Place | null> {
  try {
    return (await searchPlaces(query))[0] ?? null;
  } catch {
    return null;
  }
}
