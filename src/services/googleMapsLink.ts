export interface ParsedGoogleMapsPlace { latitude: number; longitude: number; name: string; googleMapsUrl: string; source: 'google_maps' }
export type GoogleMapsParseFailure = 'invalid' | 'short_link' | 'coordinates_missing' | 'resolver_not_configured' | 'resolve_failed'
export type GoogleMapsParseResult = { ok: true; place: ParsedGoogleMapsPlace } | { ok: false; reason: GoogleMapsParseFailure; fallbackQuery?: string }
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
  const fallbackQuery = parsed.searchParams.get('q') || parsed.searchParams.get('query') || undefined
  return { ok: false, reason: 'coordinates_missing', ...(fallbackQuery && !/^[-\d.,\s]+$/.test(fallbackQuery) ? { fallbackQuery } : {}) }
}

export function googleMapsSearchFallbacks(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  const addressMatch = normalized.match(/(?:^|\s)(\d{1,6}\s+\S.*)$/u)
  const address = addressMatch?.[1]?.trim() || ''
  const name = addressMatch ? normalized.slice(0, addressMatch.index).trim() : normalized
  return { name, queries: Array.from(new Set([normalized, address, name].filter((value) => value.length >= 2))) }
}

export async function resolveGoogleMapsShortUrl(url: string): Promise<string | null> {
  const endpoint = String(import.meta.env.VITE_GOOGLE_MAPS_RESOLVER_URL || '').trim()
  if (!endpoint) throw new Error('RESOLVER_NOT_CONFIGURED')
  const requestUrl = new URL(endpoint); requestUrl.searchParams.set('url', url)
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(requestUrl, { method: 'GET', cache: 'no-store', signal: controller.signal })
    const payload = await response.json() as { success?: boolean; expandedUrl?: unknown }
    if (!response.ok || payload.success !== true || typeof payload.expandedUrl !== 'string') throw new Error('RESOLVE_FAILED')
    return payload.expandedUrl
  } finally { clearTimeout(timeout) }
}

export async function parseOrResolveGoogleMapsUrl(input: string, resolver: GoogleMapsUrlResolver = resolveGoogleMapsShortUrl): Promise<GoogleMapsParseResult> {
  const direct = parseGoogleMapsUrl(input); if (direct.ok || direct.reason !== 'short_link') return direct
  try {
    const expanded = await resolver(input.trim()); if (!expanded) return { ok: false, reason: 'resolve_failed' }
    const resolved = parseGoogleMapsUrl(expanded)
    return resolved.ok ? { ok: true, place: { ...resolved.place, googleMapsUrl: input.trim() } } : resolved
  } catch (error) { return { ok: false, reason: error instanceof Error && error.message === 'RESOLVER_NOT_CONFIGURED' ? 'resolver_not_configured' : 'resolve_failed' } }
}
