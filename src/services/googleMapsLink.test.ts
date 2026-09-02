import { describe, expect, it, vi } from 'vitest'
import { googleMapsSearchFallbacks, parseGoogleMapsUrl, parseOrResolveGoogleMapsUrl, resolveGoogleMapsShortUrl } from './googleMapsLink'

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
  it('supports !2d longitude and !3d latitude coordinates', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/Test/data=!2d-79.3944!3d43.6289')
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6289, longitude: -79.3944 })
  })
  it('prefers the exact place pin over the map viewport center', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/Test/@43.62,-79.39/data=!8m2!3d43.6289!4d-79.3944')
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6289, longitude: -79.3944 })
  })
  it('decodes encoded and plus-separated place names', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/place/Billy+Billy+Toronto+City+Airport/@43.6218878,-79.3794573,17z')
    expect(result.ok && result.place.name).toBe('Billy Billy Toronto City Airport')
  })
  it('supports coordinate query parameters', () => {
    const result = parseGoogleMapsUrl('https://maps.google.com/?q=43.6218878%2C-79.3794573')
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6218878, longitude: -79.3794573 })
  })
  it('supports direction destination coordinates', () => {
    const result = parseGoogleMapsUrl('https://www.google.com/maps/dir/?api=1&destination=43.6289%2C-79.3944')
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6289, longitude: -79.3944 })
  })
  it('extracts fallback text from search paths and direction parameters', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/CN+Tower')).toEqual({ ok: false, reason: 'coordinates_missing', fallbackQuery: 'CN Tower' })
    expect(parseGoogleMapsUrl('https://maps.google.com/maps?destination=CN+Tower')).toEqual({ ok: false, reason: 'coordinates_missing', fallbackQuery: 'CN Tower' })
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
  it('accepts coordinates supplied by the server-side mobile-link fallback', async () => {
    const result = await parseOrResolveGoogleMapsUrl('https://maps.app.goo.gl/mobile', async () => ({ expandedUrl: 'https://www.google.com/maps?q=Airport', location: { latitude: 43.63396, longitude: -79.39713, name: 'Billy Bishop Airport' } }))
    expect(result.ok && result.place).toMatchObject({ latitude: 43.63396, longitude: -79.39713, name: 'Billy Bishop Airport', googleMapsUrl: 'https://maps.app.goo.gl/mobile' })
  })
  it('can send an expanded coordinate-free Maps URL to the resolver', async () => {
    const input = 'https://www.google.com/maps/search/CN+Tower'
    const result = await parseOrResolveGoogleMapsUrl(input, async (url) => ({ expandedUrl: url, location: { latitude: 43.6426, longitude: -79.3871, name: 'CN Tower' } }))
    expect(result.ok && result.place).toMatchObject({ latitude: 43.6426, longitude: -79.3871, googleMapsUrl: input })
  })
  it('retries a temporary Worker failure before returning coordinates', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_RESOLVER_URL', 'https://resolver.example.test')
    const request = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'RESOLVE_FAILED' }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, expandedUrl: 'https://www.google.com/maps?q=Stussy', location: { latitude: 43.6514661, longitude: -79.3971051, name: 'Stüssy' } }), { status: 200 }))
    try {
      await expect(resolveGoogleMapsShortUrl('https://maps.app.goo.gl/TUZf13bYnhcKtXF47?g_st=ic')).resolves.toMatchObject({ location: { latitude: 43.6514661, longitude: -79.3971051 } })
      expect(request).toHaveBeenCalledTimes(2)
    } finally { request.mockRestore(); vi.unstubAllEnvs() }
  })
  it('rejects non-Google URLs', () => expect(parseGoogleMapsUrl('https://example.com/@43.1,-79.1')).toEqual({ ok: false, reason: 'invalid' }))
})
