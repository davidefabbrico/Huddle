// Links with SmartPark (the parking app): separate servers, they talk only through links the user taps.
//   Huddle -> SmartPark: open "Trova" on the event place, estimating parking for the event time,
//                        with a link back to the event (and to come back once parked: see the event page).
//   Huddle -> SmartPark: join the friends' parking group (?gruppo=CODE).
//   SmartPark -> Huddle: /event/<id>?smartpark=arrivato&auto=lat,lon when you parked near the event.

import type { LatLon } from './geo';
import type { EventWithGroup } from './types';

export const SMARTPARK_URL = 'https://davidefabbrico.github.io/parking_test/';

// eventUrl: this event's page in Huddle (appUrl), used by SmartPark to bring you back
export function parkingUrl(event: EventWithGroup, place: LatLon, eventUrl: string): string {
  const url = new URL(SMARTPARK_URL);
  url.searchParams.set('meta', `${place.lat.toFixed(6)},${place.lon.toFixed(6)}`);
  url.searchParams.set('nome', event.location ? `${event.title} · ${event.location}` : event.title);
  url.searchParams.set('arrivo', event.date_time);
  url.searchParams.set('torna', eventUrl);
  url.searchParams.set('checkin', eventUrl);
  return url.href;
}

export function parkingGroupUrl(code: string): string {
  const url = new URL(SMARTPARK_URL);
  url.searchParams.set('gruppo', code);
  return url.href;
}

// SmartPark group codes: letters and digits (e.g. 622066EA)
export function normalizeParkingCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateParkingCode(code: string): string | null {
  if (!code.trim()) return null;
  return /^[A-Z0-9]{4,16}$/.test(normalizeParkingCode(code)) ? null : 'Il codice SmartPark è fatto di lettere e numeri (es. 622066EA)';
}
