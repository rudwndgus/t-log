const PRODUCTION_ORIGIN = 'https://rudwndgus.github.io'
const MAX_REDIRECTS = 5
const TIMEOUT_MS = 6_000

const isAllowedOrigin = (origin: string) => origin === PRODUCTION_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
const isShortMapsUrl = (url: URL) => url.protocol === 'https:' && (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/')))
const isGoogleMapsUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!/^([a-z0-9-]+\.)*google\.(com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i.test(url.hostname)) return false
  return url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps') || url.pathname.startsWith('/place')
}
const isAllowedTarget = (url: URL) => isShortMapsUrl(url) || isGoogleMapsUrl(url)

const responseHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin'
})
const json = (origin: string, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) })

async function expandShortUrl(input: URL) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let current = input
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if (!isAllowedTarget(current)) throw new Error('TARGET_NOT_ALLOWED')
      const response = await fetch(current.toString(), { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'TLog-Maps-Resolver/1.0' } })
      response.body?.cancel().catch(() => {})
      if (response.status < 300 || response.status >= 400) return current.toString()
      if (redirects === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS')
      const location = response.headers.get('Location'); if (!location) throw new Error('MISSING_REDIRECT')
      current = new URL(location, current)
    }
    throw new Error('TOO_MANY_REDIRECTS')
  } finally { clearTimeout(timeout) }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    if (!isAllowedOrigin(origin)) return new Response('Forbidden', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(origin) })
    if (request.method !== 'GET') return json(origin, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)
    const raw = new URL(request.url).searchParams.get('url'); if (!raw) return json(origin, { success: false, error: 'URL_REQUIRED' }, 400)
    let shortUrl: URL
    try { shortUrl = new URL(raw) } catch { return json(origin, { success: false, error: 'INVALID_URL' }, 400) }
    if (!isShortMapsUrl(shortUrl)) return json(origin, { success: false, error: 'URL_NOT_ALLOWED' }, 400)
    try { return json(origin, { success: true, expandedUrl: await expandShortUrl(shortUrl) }) }
    catch (error) { return json(origin, { success: false, error: error instanceof Error ? error.message : 'RESOLVE_FAILED' }, 502) }
  }
}
