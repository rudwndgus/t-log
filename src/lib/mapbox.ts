import { mapboxToken } from './supabase'

export interface PlaceSearchResult { id: string; name: string; address: string; latitude: number; longitude: number }

export async function searchPlaces(query: string, proximity?: [number, number]): Promise<PlaceSearchResult[]> {
  if (!mapboxToken || query.trim().length < 2) return []
  const params = new URLSearchParams({ q: query, access_token: mapboxToken, limit: '6', language: 'ko', types: 'poi,address,place' })
  if (proximity) params.set('proximity', proximity.join(','))
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
  if (!response.ok) throw new Error('SEARCH_FAILED')
  const data = await response.json() as { features: Array<{ id: string; properties?: { name?: string; full_address?: string }; geometry: { coordinates: [number, number] } }> }
  return data.features.map((feature) => ({
    id: feature.id,
    name: feature.properties?.name || query,
    address: feature.properties?.full_address || '',
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1]
  }))
}

export async function getWalkingRoute(points: Array<[number, number]>) {
  if (!mapboxToken || points.length < 2) return null
  const coordinates = points.map((point) => point.join(',')).join(';')
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&overview=full&access_token=${mapboxToken}`)
  if (!response.ok) return null
  const data = await response.json()
  return data.routes?.[0]?.geometry ?? null
}
