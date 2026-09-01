export interface PlaceSearchResult { id: string; name: string; address: string; latitude: number; longitude: number; source: 'search' }

interface NominatimResult { place_id: number; lat: string; lon: string; display_name: string; name?: string; type?: string }
const CACHE_KEY = 'tlog:geocoding-cache:v1'
const REVERSE_CACHE_KEY = 'tlog:reverse-geocoding-cache:v1'
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, PlaceSearchResult[]> } catch { return {} } }

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const normalized = query.trim().toLowerCase(); if (normalized.length < 2) return []
  const cache = readCache(); if (cache[normalized]) return cache[normalized]
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '6', addressdetails: '1', 'accept-language': navigator.language || 'ko' })
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('SEARCH_FAILED')
  const rows = await response.json() as NominatimResult[]
  const results = rows.map((row) => ({ id: String(row.place_id), name: row.name || row.display_name.split(',')[0] || row.type || query, address: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon), source: 'search' as const }))
  cache[normalized] = results; const recent = Object.fromEntries(Object.entries(cache).slice(-20)); localStorage.setItem(CACHE_KEY, JSON.stringify(recent)); return results
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`
  const cache = (() => { try { return JSON.parse(localStorage.getItem(REVERSE_CACHE_KEY) || '{}') as Record<string, string> } catch { return {} } })()
  if (cache[key]) return cache[key]
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': navigator.language || 'ko' })
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('REVERSE_GEOCODING_FAILED')
  const row = await response.json() as { display_name?: string; error?: string }
  const address = row.display_name?.trim() || null
  if (address) { cache[key] = address; const recent = Object.fromEntries(Object.entries(cache).slice(-40)); localStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(recent)) }
  return address
}
