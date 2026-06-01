// ── Ultraviolet proxy setup ────────────────────────────────────────────────────
// UV files come from vendor/aboutproxy (git submodule, MIT/GPL-3.0).
// The UV service worker intercepts all /service/uv/* requests, fetches them
// through the Bare server, strips X-Frame-Options / CSP frame-ancestors
// headers, rewrites sub-resource URLs, and returns the proxied response.
// This allows the Browser to display sites that normally block iframe embedding.

// UV is optional — if the submodule files aren't present the SW still installs.
let _uvSW = null;
try {
  importScripts('/vendor/aboutproxy/static/uv/uv.bundle.js');

  const _bareEndpoint =
    (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')
      ? 'http://localhost:8080/bare/'
      : '/bare/';

  self.__uv$config = {
    prefix:    '/service/uv/',
    bare:      _bareEndpoint,
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler:   '/vendor/aboutproxy/static/uv/uv.handler.js',
    bundle:    '/vendor/aboutproxy/static/uv/uv.bundle.js',
    config:    '/uv.config.js',
    sw:        '/vendor/aboutproxy/static/uv/uv.sw.js',
  };

  importScripts('/vendor/aboutproxy/static/uv/uv.sw.js');
  _uvSW = new UVServiceWorker();
} catch (e) {
  console.warn('[geckoOS SW] UV proxy not available:', e.message);
}

// ── geckoOS asset cache ────────────────────────────────────────────────────────

const CACHE_NAME = 'geckoOS-v1.3.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/base/reset.css',
  '/styles/base/variables.css',
  '/styles/base/typography.css',
  '/styles/components/menubar.css',
  '/styles/components/dock.css',
  '/styles/components/window.css',
  '/styles/components/context-menu.css',
  '/styles/components/spotlight.css',
  '/styles/components/notification.css',
  '/themes/default/theme.css',
  '/core/kernel/gecko.js',
  '/assets/icons/system/gecko-mark.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // UV proxy requests are intercepted first, before the cache layer.
  // Wrap in catch so a Bare server failure returns a readable HTML sentinel
  // instead of rejecting respondWith() (which causes chrome-error:// in the
  // iframe and never fires the load event, making the failure undetectable).
  if (_uvSW && event.request.url.startsWith(self.location.origin + '/service/uv/')) {
    event.respondWith(
      _uvSW.fetch(event).catch(() =>
        new Response('<html data-litz-proxy-err></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );
    return;
  }

  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Network-first for geckoOS static assets: always try the network so
  // JS module changes are picked up immediately; fall back to cache only
  // when offline.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
