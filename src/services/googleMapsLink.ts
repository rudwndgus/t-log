export interface ParsedGoogleMapsPlace { latitude: number; longitude: number; name: string; googleMapsUrl: string; source: 'google_maps' }
export type GoogleMapsParseResult = { ok: true; place: ParsedGoogleMapsPlace } | { ok: false; reason: 'invalid' | 'short_link' | 'coordinates_missing' }
export type GoogleMapsUrlResolver = (url: string) => Promise<string | null>

const coordinatePatterns = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i]
const validCoordinates = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
const isExpandedGoogleHost = (host: string) => /^([a-z0-9-]+\.)*google\.(com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i.test(host)
const isShortGoogleUrl = (url: URL) => url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'))
const safeDecode = (value: string) => { try { return decodeURIComponent(value.replace(/\+/g, ' ')) } catch { return value.replace(/\+/g, ' ') } }

export function parseGoogleMapsUrl(input: string): GoogleMapsParseResult {
  const raw = input.trim(); let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, reason: 'invalid' } }
  const host = parsed.hostname.toLowerCase()
  if (isShortGoogleUrl(parsed)) return { ok: false, reason: 'short_link' }
  if (!isExpandedGoogleHost(host)) return { ok: false, reason: 'invalid' }
  const decoded = safeDecode(raw)
  for (const pattern of coordinatePatterns) {
    const match = decoded.match(pattern); if (!match) continue
    const latitude = Number(match[1]); const longitude = Number(match[2]); if (!validCoordinates(latitude, longitude)) continue
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/i) || parsed.pathname.match(/\/place\/([^/]+)/i)
    const queryName = parsed.searchParams.get('q') || parsed.searchParams.get('query')
    const name = placeMatch ? safeDecode(placeMatch[1]) : queryName && !/^[-\d.,\s]+$/.test(queryName) ? queryName : 'Google Maps location'
    return { ok: true, place: { latitude, longitude, name, googleMapsUrl: raw, source: 'google_maps' } }
  }
  return { ok: false, reason: 'coordinates_missing' }
}

export async function resolveGoogleMapsShortUrl(url: string): Promise<string | null> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 6_000)
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store', signal: controller.signal })
    return response.url && response.url !== url ? response.url : null
  } catch {
    // Google does not currently allow this redirect request from every browser.
    // Keep this function injectable so a small resolver endpoint can be added later.
    return null
  } finally { clearTimeout(timeout) }
}

export async function parseOrResolveGoogleMapsUrl(input: string, resolver: GoogleMapsUrlResolver = resolveGoogleMapsShortUrl): Promise<GoogleMapsParseResult> {
  const direct = parseGoogleMapsUrl(input); if (direct.ok || direct.reason !== 'short_link') return direct
  const expanded = await resolver(input.trim()); if (!expanded) return direct
  const resolved = parseGoogleMapsUrl(expanded)
  return resolved.ok ? { ok: true, place: { ...resolved.place, googleMapsUrl: input.trim() } } : resolved
}
