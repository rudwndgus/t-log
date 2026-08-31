export interface PlaceSearchResult { id: string; name: string; address: string; latitude: number; longitude: number; source: 'search' }

interface NominatimResult { place_id: number; lat: string; lon: string; display_name: string; name?: string; type?: string }
const CACHE_KEY = 'tlog:geocoding-cache:v1'
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
