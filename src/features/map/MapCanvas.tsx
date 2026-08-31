import mapboxgl, { type GeoJSONSource, type Map as MapboxMap, type Marker } from 'mapbox-gl'
import { useEffect, useRef } from 'react'
import { getWalkingRoute } from '../../lib/mapbox'
import { isMapboxConfigured, mapboxToken } from '../../lib/supabase'
import type { ItineraryPlace } from '../../types'

export function MapCanvas({ places, focusedId, onSelect }: { places: ItineraryPlace[]; focusedId?: string; onSelect: (place: ItineraryPlace) => void }) {
  const containerRef = useRef<HTMLDivElement>(null); const mapRef = useRef<MapboxMap | null>(null); const markersRef = useRef<Marker[]>([]); const exploredRef = useRef(false)
  useEffect(() => {
    if (!isMapboxConfigured || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = mapboxToken
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/standard', center: [-79.3832, 43.6532], zoom: 11, attributionControl: false })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right'); map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    map.on('dragstart', () => { exploredRef.current = true }); mapRef.current = map
    return () => { markersRef.current.forEach((marker) => marker.remove()); map.remove(); mapRef.current = null }
  }, [])
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const render = async () => {
      markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []
      places.forEach((place, index) => { const element = document.createElement('button'); element.className = `map-marker ${place.id === focusedId ? 'is-focused' : ''}`; element.textContent = String(index + 1); element.addEventListener('click', () => onSelect(place)); markersRef.current.push(new mapboxgl.Marker({ element }).setLngLat([place.longitude, place.latitude]).addTo(map)) })
      const route = await getWalkingRoute(places.map((place) => [place.longitude, place.latitude]))
      const source = map.getSource('route') as GeoJSONSource | undefined
      const geojson = { type: 'Feature' as const, properties: {}, geometry: route || { type: 'LineString' as const, coordinates: places.map((place) => [place.longitude, place.latitude]) } }
      if (source) source.setData(geojson); else if (map.isStyleLoaded()) { map.addSource('route', { type: 'geojson', data: geojson }); map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#176b55', 'line-width': 4, 'line-opacity': .8 } }) }
      if (places.length && !exploredRef.current) { const bounds = new mapboxgl.LngLatBounds(); places.forEach((place) => bounds.extend([place.longitude, place.latitude])); map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 600 }) }
    }
    if (map.loaded()) void render(); else map.once('load', () => void render())
  }, [places, focusedId, onSelect])
  useEffect(() => { const place = places.find((item) => item.id === focusedId); if (place && mapRef.current) mapRef.current.flyTo({ center: [place.longitude, place.latitude], zoom: 15 }) }, [focusedId, places])
  if (!isMapboxConfigured) return <div className="map-fallback"><div className="map-grid" />{places.map((place, index) => <button key={place.id} className={`fallback-marker marker-${index % 5}`} onClick={() => onSelect(place)}>{index + 1}</button>)}<div className="map-unavailable"><strong>지도를 연결해 주세요</strong><span>Mapbox 토큰을 설정하면 핀과 경로가 표시돼요.</span></div></div>
  return <div ref={containerRef} className="map-canvas" />
}
