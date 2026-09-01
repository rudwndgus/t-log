// @ts-nocheck — kept as dashboard-pasteable JavaScript even though Wrangler uses a .ts entry.
const PRODUCTION_ORIGIN = 'https://rudwndgus.github.io';
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 6000;

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

const isAllowedRedirectTarget = (url) =>
  isShortMapsUrl(url) || isGoogleHost(url);

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
  const query = expanded.searchParams.get('q') || expanded.searchParams.get('query');

  if (!query || /^[-\d.,\s]+$/.test(query)) return null;

  const fallback = searchFallbacks(query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (const candidate of fallback.queries) {
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

      if (!response.ok) continue;

      const rows = await response.json();
      const row = rows[0];
      if (!row) continue;

      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      return {
        latitude,
        longitude,
        name: fallback.name || row.name || candidate,
        address: row.display_name || '',
      };
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function expandShortUrl(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let current = input;

  try {
    for (
      let redirects = 0;
      redirects <= MAX_REDIRECTS;
      redirects += 1
    ) {
      if (!isAllowedRedirectTarget(current)) {
        throw new Error('TARGET_NOT_ALLOWED');
      }

      const response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'TLog-Maps-Resolver/1.0',
        },
      });

      response.body?.cancel().catch(() => {});

      if (response.status < 300 || response.status >= 400) {
        if (!response.ok || !isGoogleMapsUrl(current)) {
          throw new Error('RESOLVE_FAILED');
        }

        return current.toString();
      }

      if (redirects === MAX_REDIRECTS) {
        throw new Error('TOO_MANY_REDIRECTS');
      }

      const location = response.headers.get('Location');

      if (!location) {
        throw new Error('MISSING_REDIRECT');
      }

      current = new URL(location, current);
    }

    throw new Error('TOO_MANY_REDIRECTS');
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request) {
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

    if (!isShortMapsUrl(shortUrl)) {
      return json(
        origin,
        { success: false, error: 'URL_NOT_ALLOWED' },
        400
      );
    }

    try {
      const expandedUrl = await expandShortUrl(shortUrl);
      const location = await geocodeExpandedUrl(expandedUrl);

      return json(origin, {
        success: true,
        expandedUrl,
        ...(location ? { location } : {}),
      });
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
