// ════════════════════════════════════════════════════════════
//  Journalyze — Service Worker (Next.js compatible)
//  Ported from HTML version → Next.js App Router
// ════════════════════════════════════════════════════════════

// v3: nama cache dinaikkan supaya cache lama yang berisi chunk dev basi
// (penyebab "Cannot read properties of undefined (reading 'call')") ikut terhapus saat activate.
const CACHE_NAME = 'journalyze-v3';
const CACHE_VERSION = '1.6.0'; // Fix: jangan cache chunk /_next/static/ yang tidak ber-hash (mode dev)

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

// Mode dev (localhost / IP lokal): chunk Next.js namanya TIDAK ber-hash dan isinya berubah
// setiap kali kode diedit, jadi tidak boleh di-cache sama sekali.
const DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
const IS_LOCAL_HOST =
  DEV_HOSTS.indexOf(self.location.hostname) !== -1 ||
  self.location.hostname.endsWith('.local') ||
  /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(self.location.hostname);

// File production Next.js selalu punya hash konten di namanya (contoh: 2117-e8ab78786470d94c.js).
// Hanya file seperti itu yang aman di-cache "Cache First".
function isHashedAsset(pathname) {
  const file = pathname.split('/').pop() || '';
  return /[0-9a-f]{8,}/.test(file);
}

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

  // Mode dev: semua file /_next/ langsung ke network, tanpa cache
  if (IS_LOCAL_HOST && url.pathname.startsWith('/_next/')) return;

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

  // Next.js static chunks → Cache First, HANYA untuk file ber-hash (production)
  if (url.pathname.startsWith('/_next/static/')) {
    if (!isHashedAsset(url.pathname)) return; // tidak ber-hash → selalu network
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
