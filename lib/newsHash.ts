// lib/newsHash.ts
// Dipakai bersama oleh hooks/useNewsAI.ts (client) dan app/api/news-cache/route.ts (server)
// supaya hash judul dan aturan "analisis valid" selalu identik di kedua sisi.

export const NEWS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

export function hashTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(title.length, 80); i++) {
    h = ((h << 5) - h) + title.charCodeAt(i);
    h |= 0;
  }
  return 'nh_' + Math.abs(h).toString(36);
}

export const FALLBACK_MARKERS = [
  'Tambahkan API key', 'aistudio.google.com', 'Pengaturan AI',
  'Rate limit', 'Koneksi ke AI', 'Gagal memuat',
];

export function isValidAnalysis(text?: string): boolean {
  if (!text || text.length < 80) return false;
  return !FALLBACK_MARKERS.some(m => text.includes(m));
}
