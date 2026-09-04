import { describe, expect, it } from 'vitest'
import { selectableTransportMode, transportModeOptions } from './transportModes'

describe('transport modes', () => {
  it('offers the six icon modes used by the itinerary', () => {
    expect(transportModeOptions.map((mode) => mode.value)).toEqual(['walk', 'driving', 'cycling', 'bus', 'train', 'plane'])
  })

  it('keeps legacy saved modes visible with a current icon', () => {
    expect(selectableTransportMode('transit')).toBe('bus')
    expect(selectableTransportMode('shuttle')).toBe('bus')
    expect(selectableTransportMode('ferry')).toBe('train')
    expect(selectableTransportMode('other')).toBe('walk')
  })
})
