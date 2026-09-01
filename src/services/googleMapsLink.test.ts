import { describe, expect, it } from 'vitest'
import { googleMapsSearchFallbacks, parseGoogleMapsUrl, parseOrResolveGoogleMapsUrl } from './googleMapsLink'

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
  it('decodes encoded and plus-separated place names', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/Billy+Billy+Toronto+City+Airport/@43.6218878,-79.3794573,17z')
    expect(result.ok && result.place.name).toBe('Billy Billy Toronto City Airport')
  })
  it('supports coordinate query parameters', () => {
    const result = parseGoogleMapsUrl('https://maps.google.com/?q=43.6218878%2C-79.3794573')
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6218878, longitude: -79.3794573 })
  })
  it('returns a graceful short-link result', () => expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toEqual({ ok: false, reason: 'short_link' }))
  it('can resolve a short link through an injectable resolver', async () => {
    const result = await parseOrResolveGoogleMapsUrl('https://maps.app.goo.gl/abc123', async () => 'https://www.google.com/maps/place/CN+Tower/@43.6426,-79.3871,17z')
    expect(result.ok && result.place).toMatchObject({ name: 'CN Tower', googleMapsUrl: 'https://maps.app.goo.gl/abc123' })
  })
  it('preserves a text query when a mobile shared URL has no coordinates', async () => {
    const result = await parseOrResolveGoogleMapsUrl('https://maps.app.goo.gl/mobile', async () => 'https://www.google.com/maps?q=%EB%B9%8C%EB%A6%AC+%EB%B9%84%EC%88%8D+%EA%B3%B5%ED%95%AD+2+Eireann+Quay,+Toronto,+ON+M5V+1A1&ftid=abc')
    expect(result).toEqual({ ok: false, reason: 'coordinates_missing', fallbackQuery: '빌리 비숍 공항 2 Eireann Quay, Toronto, ON M5V 1A1' })
    expect(googleMapsSearchFallbacks(result.ok ? '' : result.fallbackQuery || '')).toEqual({ name: '빌리 비숍 공항', queries: ['빌리 비숍 공항 2 Eireann Quay, Toronto, ON M5V 1A1', '2 Eireann Quay, Toronto, ON M5V 1A1', '빌리 비숍 공항'] })
  })
  it('rejects non-Google URLs', () => expect(parseGoogleMapsUrl('https://example.com/@43.1,-79.1')).toEqual({ ok: false, reason: 'invalid' }))
})
