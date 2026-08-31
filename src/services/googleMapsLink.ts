export interface ParsedGoogleMapsPlace { latitude: number; longitude: number; name: string; googleMapsUrl: string; source: 'google_maps' }
export type GoogleMapsParseResult = { ok: true; place: ParsedGoogleMapsPlace } | { ok: false; reason: 'invalid' | 'short_link' | 'coordinates_missing' }

const coordinatePatterns = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i]
const validCoordinates = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180

export function parseGoogleMapsUrl(input: string): GoogleMapsParseResult {
  const raw = input.trim(); let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, reason: 'invalid' } }
  const host = parsed.hostname.toLowerCase(); if (!host.includes('google.') && host !== 'maps.app.goo.gl' && host !== 'goo.gl') return { ok: false, reason: 'invalid' }
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return { ok: false, reason: 'short_link' }
  const decoded = decodeURIComponent(raw)
  for (const pattern of coordinatePatterns) {
    const match = decoded.match(pattern); if (!match) continue
    const latitude = Number(match[1]); const longitude = Number(match[2]); if (!validCoordinates(latitude, longitude)) continue
    const placeMatch = parsed.pathname.match(/\/place\/([^/]+)/); const queryName = parsed.searchParams.get('q') || parsed.searchParams.get('query'); const name = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : queryName && !/^[-\d.,\s]+$/.test(queryName) ? queryName : 'Google Maps location'
    return { ok: true, place: { latitude, longitude, name, googleMapsUrl: raw, source: 'google_maps' } }
  }
  return { ok: false, reason: 'coordinates_missing' }
}
