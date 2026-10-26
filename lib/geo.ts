// Small geography helpers

export interface LatLon {
  lat: number;
  lon: number;
}

// Distance in meters (haversine)
export function distanceMeters(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "350 m" / "1,2 km"
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

// Opens the point in the phone's maps app (Google Maps link works on iPhone, Android and desktop)
export function mapsUrl({ lat, lon }: LatLon): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

// "lat,lon" from a URL parameter, or null
export function parseLatLon(value: string | undefined | null): LatLon | null {
  const [lat, lon] = String(value ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
