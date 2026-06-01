/**
 * functions/bare/[[path]].js
 * Cloudflare Pages Function — Bare v2 server for Ultraviolet proxy.
 *
 * Handles:
 *   GET  /bare/v2   → server info (required by UV on startup)
 *   POST /bare/v2/  → proxy a URL, strip X-Frame-Options / CSP frame-ancestors
 *
 * UV's service worker (sw.js) fetches every proxied resource through here.
 * This is what allows YouTube, GitHub, etc. to load inside Litzium iframes.
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': '*',
};

// Headers that prevent framing — stripped from every proxied response.
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'clear-site-data',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
]);

export async function onRequest({ request }) {
  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url  = new URL(request.url);
  const path = url.pathname; // e.g. /bare/v2 or /bare/v2/

  // ── GET /bare/v2 — server capability manifest ──────────────────────────────
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      versions: ['v2'],
      language: 'Cloudflare',
      memoryUsage: 0,
      maintainer: { email: '', website: 'https://geckoOS.pages.dev' },
      project: {
        name:        'geckoOS Bare',
        description: 'Bare v2 server running on Cloudflare Pages Functions',
        repository:  'https://github.com/geckoos/geckoos',
        version:     '2.0.0',
      },
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── POST /bare/v2/ — proxy request ────────────────────────────────────────
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  const targetUrl = request.headers.get('x-bare-url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ message: 'Missing X-Bare-URL header' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Parse the headers UV wants us to forward to the target
  let forwardHeaders = {};
  try { forwardHeaders = JSON.parse(request.headers.get('x-bare-headers') || '{}'); } catch {}

  const fetchHeaders = new Headers();
  for (const [k, v] of Object.entries(forwardHeaders)) {
    try { fetchHeaders.set(k, v); } catch {}
  }

  const method = request.headers.get('x-bare-method') || request.method;
  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());

  // ── Proxy the request ──────────────────────────────────────────────────────
  let proxied;
  try {
    proxied = await fetch(targetUrl, {
      method,
      headers: fetchHeaders,
      body:    hasBody ? request.body : undefined,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(JSON.stringify({ message: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── Build response headers ─────────────────────────────────────────────────
  const rawHeaders = {};
  for (const [k, v] of proxied.headers) {
    if (!STRIP_HEADERS.has(k.toLowerCase())) rawHeaders[k] = v;
  }

  const outHeaders = new Headers(CORS);
  outHeaders.set('x-bare-status',      String(proxied.status));
  outHeaders.set('x-bare-status-text', proxied.statusText || '');
  outHeaders.set('x-bare-headers',     JSON.stringify(rawHeaders));

  return new Response(proxied.body, {
    status:  200,          // Bare spec: outer status is always 200
    headers: outHeaders,
  });
}
