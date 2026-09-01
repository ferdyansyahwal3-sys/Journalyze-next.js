// ════════════════════════════════════════════════════════════
//  Journalyze — Service Worker (Next.js compatible)
//  Ported from HTML version → Next.js App Router
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'journalyze-v2';
const CACHE_VERSION = '1.5.0'; // Fix: bypass SW untuk /api/ routes

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

const CDN_CACHE_NAME = 'journalyze-cdn-v2';
const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

const NO_CACHE_PATTERNS = [
  'supabase.co',
  'anthropic.com',
  'api.anthropic.com',
  'api.rss2json.com',
  'generativelanguage.googleapis.com',  // Gemini API — jangan dicache
];

// Path internal Next.js yang tidak boleh diintersep SW
const NO_CACHE_PATHS = [
  '/api/',  // SEMUA Next.js API routes — rss-proxy, econ-calendar, dsb
];

const NEXT_INTERNAL_PATTERNS = [
  '/_next/webpack-hmr',
  '/__nextjs',
];

// ── Install ──
self.addEventListener('install', (event) => {
  console.log('[SW] Install — version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) =>
        console.warn('[SW] Beberapa asset gagal di-cache:', err)
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== CDN_CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (NO_CACHE_PATTERNS.some((p) => url.hostname.includes(p))) return;
  if (NEXT_INTERNAL_PATTERNS.some((p) => url.pathname.startsWith(p))) return;
  // API routes Next.js — bypass SW sepenuhnya, selalu network
  if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) return;

  // CDN → Cache First
  if (CDN_PATTERNS.some((p) => url.hostname.includes(p))) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Next.js static chunks → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Navigasi → bypass SW sepenuhnya, biarkan Next.js handle
  if (event.request.mode === 'navigate') return;

  // Asset lain → passthrough, tidak di-cache (hindari clone error)
  return;
});

// ── Push notification ──
self.addEventListener('push', (event) => {
  let data = {
    title: '🔴 Journalyze Alert',
    body: 'Ada berita high impact baru!',
    url: '/',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'high-impact-news',
  };
  if (event.data) {
    try { Object.assign(data, event.data.json()); }
    catch { data.body = event.data.text() || data.body; }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
      actions: [
        { action: 'open', title: '📊 Lihat Berita' },
        { action: 'close', title: 'Tutup' },
      ],
    })
  );
});

// ── Notification click ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_NEWS_TAB' });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Message ──
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});