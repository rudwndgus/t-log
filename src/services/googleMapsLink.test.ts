import { describe, expect, it } from 'vitest'
import { parseGoogleMapsUrl } from './googleMapsLink'

describe('Google Maps URL parser', () => {
  it('extracts coordinates and a place name from an expanded URL', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/CN+Tower/@43.6426,-79.3871,17z')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.place).toMatchObject({ latitude: 43.6426, longitude: -79.3871, name: 'CN Tower' })
  })
  it('supports !3d latitude and !4d longitude coordinates', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/Test/data=!3d37.5665!4d126.9780')
    expect(result.ok && result.place.longitude).toBe(126.978)
  })
  it('returns a graceful short-link result', () => expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toEqual({ ok: false, reason: 'short_link' }))
  it('rejects non-Google URLs', () => expect(parseGoogleMapsUrl('https://example.com/@43.1,-79.1')).toEqual({ ok: false, reason: 'invalid' }))
})
