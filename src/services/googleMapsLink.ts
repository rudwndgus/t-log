export interface ParsedGoogleMapsPlace { latitude: number; longitude: number; name: string; googleMapsUrl: string; source: 'google_maps' }
export interface ResolvedGoogleMapsUrl { expandedUrl: string; location?: { latitude: number; longitude: number; name?: string } }
export type GoogleMapsParseFailure = 'invalid' | 'short_link' | 'coordinates_missing' | 'resolver_not_configured' | 'resolve_failed'
export type GoogleMapsParseResult = { ok: true; place: ParsedGoogleMapsPlace } | { ok: false; reason: GoogleMapsParseFailure; fallbackQuery?: string }
export type GoogleMapsUrlResolver = (url: string) => Promise<string | ResolvedGoogleMapsUrl | null>

const coordinatePatterns = [
  { pattern: /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/, latitudeIndex: 1, longitudeIndex: 2 },
  { pattern: /!2d(-?\d{1,3}(?:\.\d+)?)!3d(-?\d{1,3}(?:\.\d+)?)/, latitudeIndex: 2, longitudeIndex: 1 },
  { pattern: /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/, latitudeIndex: 1, longitudeIndex: 2 },
  { pattern: /[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i, latitudeIndex: 1, longitudeIndex: 2 },
]
const validCoordinates = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
const isExpandedGoogleHost = (host: string) => /^([a-z0-9-]+\.)*google\.(com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i.test(host)
const isShortGoogleUrl = (url: URL) => url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'))
const safeDecode = (value: string) => { try { return decodeURIComponent(value.replace(/\+/g, ' ')) } catch { return value.replace(/\+/g, ' ') } }
const isExpandedGoogleMapsUrl = (url: URL) => isExpandedGoogleHost(url.hostname.toLowerCase()) && (url.hostname.toLowerCase().startsWith('maps.') || /^\/(?:maps|place|search)(?:\/|$)/i.test(url.pathname))
const isCoordinateQuery = (value: string) => /^(?:loc:)?\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?(?:\s.*)?$/i.test(value)
const textQueryFromUrl = (url: URL) => {
  for (const key of ['q', 'query', 'destination', 'daddr', 'address']) {
    const value = url.searchParams.get(key)?.trim()
    if (value && !isCoordinateQuery(value)) return value
  }

  const pathMatch = url.pathname.match(/\/(?:maps\/)?(?:place|search)\/([^/]+)/i)
  if (pathMatch?.[1]) return safeDecode(pathMatch[1])

  const directionMatch = url.pathname.match(/\/(?:maps\/)?dir\/(?:[^/]+\/)*([^/@]+)(?:\/|$)/i)
  return directionMatch?.[1] ? safeDecode(directionMatch[1]) : undefined
}

export function parseGoogleMapsUrl(input: string): GoogleMapsParseResult {
  const raw = input.trim(); let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, reason: 'invalid' } }
  if (isShortGoogleUrl(parsed)) return { ok: false, reason: 'short_link' }
  if (!isExpandedGoogleMapsUrl(parsed)) return { ok: false, reason: 'invalid' }
  const decoded = safeDecode(raw)
  for (const { pattern, latitudeIndex, longitudeIndex } of coordinatePatterns) {
    const match = decoded.match(pattern); if (!match) continue
    const latitude = Number(match[latitudeIndex]); const longitude = Number(match[longitudeIndex]); if (!validCoordinates(latitude, longitude)) continue
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/i) || parsed.pathname.match(/\/place\/([^/]+)/i)
    const queryName = textQueryFromUrl(parsed)
    const name = placeMatch ? safeDecode(placeMatch[1]) : queryName && !/^[-\d.,\s]+$/.test(queryName) ? queryName : 'Google Maps location'
    return { ok: true, place: { latitude, longitude, name, googleMapsUrl: raw, source: 'google_maps' } }
  }
  const fallbackQuery = textQueryFromUrl(parsed)
  return { ok: false, reason: 'coordinates_missing', ...(fallbackQuery ? { fallbackQuery } : {}) }
}

export function googleMapsSearchFallbacks(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  const addressMatch = normalized.match(/(?:^|\s)(\d{1,6}\s+\S.*)$/u)
  const address = addressMatch?.[1]?.trim() || ''
  const name = addressMatch ? normalized.slice(0, addressMatch.index).trim() : normalized
  return { name, queries: Array.from(new Set([normalized, address, name].filter((value) => value.length >= 2))) }
}

export async function resolveGoogleMapsShortUrl(url: string): Promise<ResolvedGoogleMapsUrl | null> {
  const endpoint = String(import.meta.env.VITE_GOOGLE_MAPS_RESOLVER_URL || '').trim()
  if (!endpoint) throw new Error('RESOLVER_NOT_CONFIGURED')
  const requestUrl = new URL(endpoint); requestUrl.searchParams.set('url', url)
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(requestUrl, { method: 'GET', cache: 'no-store', signal: controller.signal })
    const payload = await response.json() as { success?: boolean; expandedUrl?: unknown; location?: { latitude?: unknown; longitude?: unknown; name?: unknown } }
    if (!response.ok || payload.success !== true || typeof payload.expandedUrl !== 'string') throw new Error('RESOLVE_FAILED')
    const latitude = Number(payload.location?.latitude); const longitude = Number(payload.location?.longitude)
    return { expandedUrl: payload.expandedUrl, ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { location: { latitude, longitude, name: typeof payload.location?.name === 'string' ? payload.location.name : undefined } } : {}) }
  } finally { clearTimeout(timeout) }
}

export async function parseOrResolveGoogleMapsUrl(input: string, resolver: GoogleMapsUrlResolver = resolveGoogleMapsShortUrl): Promise<GoogleMapsParseResult> {
  const direct = parseGoogleMapsUrl(input); if (direct.ok || (direct.reason !== 'short_link' && direct.reason !== 'coordinates_missing')) return direct
  try {
    const resolution = await resolver(input.trim()); if (!resolution) return { ok: false, reason: 'resolve_failed' }
    if (typeof resolution !== 'string' && resolution.location) return { ok: true, place: { latitude: resolution.location.latitude, longitude: resolution.location.longitude, name: resolution.location.name || 'Google Maps location', googleMapsUrl: input.trim(), source: 'google_maps' } }
    const expanded = typeof resolution === 'string' ? resolution : resolution.expandedUrl; const resolved = parseGoogleMapsUrl(expanded)
    return resolved.ok ? { ok: true, place: { ...resolved.place, googleMapsUrl: input.trim() } } : resolved
  } catch (error) { return { ok: false, reason: error instanceof Error && error.message === 'RESOLVER_NOT_CONFIGURED' ? 'resolver_not_configured' : 'resolve_failed' } }
}
