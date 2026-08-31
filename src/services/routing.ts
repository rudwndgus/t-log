import type { Feature, LineString } from 'geojson'
import type { ItineraryPlace } from '../types'

export interface RoutingService { route: (places: ItineraryPlace[]) => Promise<Feature<LineString>> }
export const straightLineRouting: RoutingService = {
  async route(places) { return { type: 'Feature', properties: { kind: 'waypoint-line' }, geometry: { type: 'LineString', coordinates: places.map((place) => [place.longitude, place.latitude]) } } }
}
