// Kept as dashboard-pasteable JavaScript even though Wrangler uses a .ts entry.
const PRODUCTION_ORIGIN = 'https://rudwndgus.github.io';
const TIMEOUT_MS = 10000;
const RESOLVE_ATTEMPTS = 3;

const isAllowedOrigin = (origin) =>
  origin === PRODUCTION_ORIGIN ||
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const isShortMapsUrl = (url) =>
  url.protocol === 'https:' &&
  (
    url.hostname === 'maps.app.goo.gl' ||
    (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'))
  );

const isGoogleHost = (url) => {
  if (url.protocol !== 'https:') return false;

  return /^([a-z0-9-]+\.)*google\.(com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i.test(
    url.hostname
  );
};

const isGoogleMapsUrl = (url) => {
  if (!isGoogleHost(url)) return false;

  return (
    url.hostname.startsWith('maps.') ||
    url.pathname.startsWith('/maps') ||
    url.pathname.startsWith('/place')
  );
};

const responseHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
});

const json = (origin, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });

const searchFallbacks = (query) => {
  const normalized = query.trim().replace(/\s+/g, ' ');
  const addressMatch = normalized.match(/(?:^|\s)(\d{1,6}\s+\S.*)$/u);
  const address = addressMatch?.[1]?.trim() || '';
  const name = addressMatch
    ? normalized.slice(0, addressMatch.index).trim()
    : normalized;

  return {
    name,
    queries: [...new Set([normalized, address, name].filter((value) => value.length >= 2))],
  };
};

async function geocodeExpandedUrl(expandedUrl) {
  const expanded = new URL(expandedUrl);
  const pathMatch = expanded.pathname.match(/\/(?:place|search)\/([^/]+)/i);
  const pathQuery = pathMatch
    ? decodeURIComponent(pathMatch[1].replace(/\+/g, ' '))
    : '';
  const query =
    expanded.searchParams.get('q') ||
    expanded.searchParams.get('query') ||
    expanded.searchParams.get('destination') ||
    expanded.searchParams.get('daddr') ||
    expanded.searchParams.get('address') ||
    pathQuery;

  if (!query || /^[-\d.,\s]+$/.test(query)) return null;

  const fallback = searchFallbacks(query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (const candidate of fallback.queries) {
      try {
        const endpoint = new URL('https://nominatim.openstreetmap.org/search');
        endpoint.search = new URLSearchParams({
          q: candidate,
          format: 'jsonv2',
          limit: '1',
          addressdetails: '1',
          'accept-language': 'ko,en',
        }).toString();

        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TLog/1.0 (https://rudwndgus.github.io/t-log/)',
          },
        });

        if (response.ok) {
          const rows = await response.json();
          const row = rows[0];
          const latitude = Number(row?.lat);
          const longitude = Number(row?.lon);

          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            return {
              latitude,
              longitude,
              name: fallback.name || row.name || candidate,
              address: row.display_name || '',
            };
          }
        }
      } catch (error) {
        if (controller.signal.aborted) throw error;
      }

      try {
        const endpoint = new URL('https://photon.komoot.io/api/');
        endpoint.search = new URLSearchParams({
          q: candidate,
          limit: '1',
          lang: 'en',
        }).toString();

        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TLog/1.0 (https://rudwndgus.github.io/t-log/)',
          },
        });

        if (!response.ok) continue;

        const payload = await response.json();
        const feature = payload.features?.[0];
        const longitude = Number(feature?.geometry?.coordinates?.[0]);
        const latitude = Number(feature?.geometry?.coordinates?.[1]);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        const properties = feature.properties || {};
        const address = [
          properties.street,
          properties.housenumber,
          properties.city,
          properties.state,
          properties.country,
        ].filter(Boolean).join(', ');

        return {
          latitude,
          longitude,
          name: fallback.name || properties.name || candidate,
          address,
        };
      } catch (error) {
        if (controller.signal.aborted) throw error;
      }
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function expandShortUrl(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let attempt = 0; attempt < RESOLVE_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(input.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (compatible; TLogMapsResolver/1.0)',
          },
        });
        const expanded = new URL(response.url);
        response.body?.cancel().catch(() => {});

        if (response.ok && isGoogleMapsUrl(expanded)) {
          return expanded.toString();
        }
      } catch (error) {
        if (controller.signal.aborted) throw error;
      }

      if (attempt + 1 < RESOLVE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
      }
    }

    throw new Error('RESOLVE_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request, _environment, context) {
    const origin = request.headers.get('Origin') || '';

    if (!isAllowedOrigin(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders(origin),
      });
    }

    if (request.method !== 'GET') {
      return json(
        origin,
        { success: false, error: 'METHOD_NOT_ALLOWED' },
        405
      );
    }

    const raw = new URL(request.url).searchParams.get('url');

    if (!raw) {
      return json(
        origin,
        { success: false, error: 'URL_REQUIRED' },
        400
      );
    }

    let shortUrl;

    try {
      shortUrl = new URL(raw);
    } catch {
      return json(
        origin,
        { success: false, error: 'INVALID_URL' },
        400
      );
    }

    if (!isShortMapsUrl(shortUrl) && !isGoogleMapsUrl(shortUrl)) {
      return json(
        origin,
        { success: false, error: 'URL_NOT_ALLOWED' },
        400
      );
    }

    try {
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const cacheUrl = new URL(request.url);
      cacheUrl.searchParams.set('__origin', origin);
      const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
      const cached = cache ? await cache.match(cacheKey) : null;
      if (cached) return cached;

      const expandedUrl = isShortMapsUrl(shortUrl)
        ? await expandShortUrl(shortUrl)
        : shortUrl.toString();
      const location = await geocodeExpandedUrl(expandedUrl);
      const response = json(origin, {
        success: true,
        expandedUrl,
        ...(location ? { location } : {}),
      });
      response.headers.set('Cache-Control', 'public, max-age=86400');
      if (cache && context?.waitUntil) context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return json(
        origin,
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'RESOLVE_FAILED',
        },
        502
      );
    }
  },
};
