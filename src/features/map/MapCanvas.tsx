import { AttributionControl, LngLatBounds, Map, Marker, NavigationControl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { straightLineRouting } from '../../services/routing'
import type { ItineraryPlace } from '../../types'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
interface Coordinate { latitude: number; longitude: number }

export function MapCanvas({ places, focusedId, resetKey, pinMode = false, draftPin, onSelect, onMapClick }: { places: ItineraryPlace[]; focusedId?: string; resetKey: string | number; pinMode?: boolean; draftPin?: Coordinate | null; onSelect: (place: ItineraryPlace) => void; onMapClick?: (coordinate: Coordinate) => void }) {
  const containerRef = useRef<HTMLDivElement>(null); const mapRef = useRef<Map | null>(null); const markersRef = useRef<Marker[]>([]); const draftMarkerRef = useRef<Marker | null>(null); const exploredRef = useRef(false); const [failed, setFailed] = useState(false); const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    const container = containerRef.current; if (!container) return
    let disposed = false; let failureTimer: ReturnType<typeof setTimeout> | undefined; let resizeFrame = 0
    const resize = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => mapRef.current?.resize()) }
    const initialize = () => {
      if (disposed || mapRef.current) return
      const bounds = container.getBoundingClientRect(); if (bounds.width < 2 || bounds.height < 2) return
      const map = new Map({ container, style: STYLE_URL, center: [-79.3832, 43.6532], zoom: 11, attributionControl: false })
      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right'); map.addControl(new AttributionControl({ compact: true }))
      map.on('dragstart', () => { exploredRef.current = true })
      map.on('load', () => { if (failureTimer) clearTimeout(failureTimer); setFailed(false); setMapReady(true); container.dataset.mapLoaded = 'true'; resize() })
      map.on('styledata', resize)
      const canvas = map.getCanvas(); const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true) }; const onContextRestored = () => { setFailed(false); resize() }
      canvas.addEventListener('webglcontextlost', onContextLost); canvas.addEventListener('webglcontextrestored', onContextRestored)
      failureTimer = setTimeout(() => { if (!map.isStyleLoaded()) setFailed(true) }, 15_000)
      requestAnimationFrame(resize)
    }
    const resizeObserver = new ResizeObserver(() => { initialize(); resize() }); resizeObserver.observe(container)
    const onVisible = () => { if (!document.hidden) { initialize(); resize() } }
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize)
    initialize(); requestAnimationFrame(initialize)
    return () => {
      disposed = true; if (failureTimer) clearTimeout(failureTimer); cancelAnimationFrame(resizeFrame); resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize)
      markersRef.current.forEach((marker) => marker.remove()); draftMarkerRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null
    }
  }, [])
  useEffect(() => { exploredRef.current = false }, [resetKey])
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return
    const render = async () => {
      markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []
      places.forEach((place, index) => { const element = document.createElement('button'); element.className = `map-marker ${place.id === focusedId ? 'is-focused' : ''}`; const label = document.createElement('span'); label.textContent = String(index + 1); element.appendChild(label); element.addEventListener('click', (event) => { event.stopPropagation(); onSelect(place) }); markersRef.current.push(new Marker({ element }).setLngLat([place.longitude, place.latitude]).addTo(map)) })
      const route = await straightLineRouting.route(places); if (containerRef.current) containerRef.current.dataset.routePointCount = String(route.geometry.coordinates.length); const source = map.getSource('route') as GeoJSONSource | undefined
      if (source) source.setData(route); else if (map.isStyleLoaded()) { map.addSource('route', { type: 'geojson', data: route }); map.addLayer({ id: 'route-halo', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': .9 } }); map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#176b55', 'line-width': 4, 'line-opacity': .85 } }) }
      if (places.length && !exploredRef.current) { const bounds = new LngLatBounds(); places.forEach((place) => bounds.extend([place.longitude, place.latitude])); map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 500 }) }
      map.resize()
    }
    void render()
  }, [places, focusedId, onSelect, resetKey, mapReady])
  useEffect(() => { const map = mapRef.current; if (!map || !onMapClick) return; const handler = (event: MapMouseEvent) => { if (pinMode) onMapClick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }) }; map.on('click', handler); return () => { map.off('click', handler) } }, [pinMode, onMapClick])
  useEffect(() => { draftMarkerRef.current?.remove(); draftMarkerRef.current = null; if (!draftPin || !mapRef.current) return; const element = document.createElement('div'); element.className = 'draft-marker'; draftMarkerRef.current = new Marker({ element }).setLngLat([draftPin.longitude, draftPin.latitude]).addTo(mapRef.current) }, [draftPin])
  useEffect(() => { const place = places.find((item) => item.id === focusedId); if (place && mapRef.current) mapRef.current.flyTo({ center: [place.longitude, place.latitude], zoom: 15 }) }, [focusedId, places])
  return <div className={`map-canvas-wrap ${pinMode ? 'is-pin-mode' : ''}`}><div ref={containerRef} className="map-canvas" />{failed && <div className="map-unavailable"><strong>지도를 불러오지 못했어요</strong><span>네트워크를 확인한 뒤 다시 시도해 주세요.</span></div>}</div>
}
