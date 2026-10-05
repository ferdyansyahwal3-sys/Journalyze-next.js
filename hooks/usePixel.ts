'use client';

import { useCallback, useEffect, useState } from 'react';
import { _sb } from '@/lib/supabaseClient';

/* ════════════════════════════════════════════════════════════
   TIPE
   ════════════════════════════════════════════════════════════ */

export type PixelTriggerType =
  | 'page_load'        // halaman dibuka
  | 'click'            // elemen diklik (selector CSS atau text:Teks)
  | 'scroll'           // scroll mencapai X%
  | 'pay_click'        // tombol bayar diklik (dipanggil dari /order & /checkout)
  | 'payment_success'; // pembayaran sukses (dipanggil dari /order & /checkout)

export type PixelValueMode = 'none' | 'fixed' | 'auto';

// Jenis analitik. Saat ini hanya Meta Pixel; jenis lain tinggal ditambah di sini.
export type PixelAnalyticsType = 'meta_pixel';

export interface PixelAnalytics {
  id: string;
  type: PixelAnalyticsType;
  name: string;
  pixelId: string;
  testCode?: string;       // opsional (data lama); Kode Testing sekarang disimpan di localStorage admin
  enabled: boolean;
}

export interface PixelRule {
  id: string;
  enabled: boolean;
  event: string;            // nama event Meta (standar atau custom)
  pages: string;            // pola halaman dipisah koma: "/upgrade, /order", "/blog/*", "*"
  trigger: PixelTriggerType;
  selector?: string;        // untuk trigger 'click'
  scrollPercent?: number;   // untuk trigger 'scroll' (1-100)
  valueMode: PixelValueMode;
  value?: number;           // untuk valueMode 'fixed'
  contentName?: string;
  targets?: string[];       // id analitik tujuan; kosong/undefined = semua analitik aktif
}

export interface PixelConfig {
  analytics: PixelAnalytics[];
  rules: PixelRule[];
}

export interface PixelContextData {
  value?: number;
  content_name?: string;
  eventId?: string;       // deduplikasi dengan Conversion API (mis. order_id)
}

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
  }
}

/* ════════════════════════════════════════════════════════════
   KONSTANTA
   ════════════════════════════════════════════════════════════ */

export const STANDARD_EVENTS: string[] = [
  'PageView',
  'ViewContent',
  'Search',
  'AddToCart',
  'AddToWishlist',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'Lead',
  'CompleteRegistration',
  'Contact',
  'Subscribe',
  'StartTrial',
  'SubmitApplication',
  'Schedule',
  'CustomizeProduct',
  'Donate',
  'FindLocation',
];

const TRIGGERS: PixelTriggerType[] = ['page_load', 'click', 'scroll', 'pay_click', 'payment_success'];
const VALUE_MODES: PixelValueMode[] = ['none', 'fixed', 'auto'];
const ANALYTICS_TYPES: PixelAnalyticsType[] = ['meta_pixel'];

const TRIGGER_NAMES: Record<PixelTriggerType, string> = {
  page_load: 'Halaman dibuka',
  click: 'Elemen diklik',
  scroll: 'Scroll halaman',
  pay_click: 'Tombol bayar diklik',
  payment_success: 'Pembayaran sukses',
};

// Aturan awal — sama dengan perilaku tetap sebelumnya.
// Catatan: /home dialihkan (redirect) ke "/", jadi halaman utama dicocokkan lewat "/".
export const DEFAULT_PIXEL_RULES: PixelRule[] = [
  { id: 'r_pageview', enabled: true, event: 'PageView', pages: '/', trigger: 'page_load', valueMode: 'none' },
  {
    id: 'r_viewcontent',
    enabled: true,
    event: 'ViewContent',
    pages: '/upgrade, /order',
    trigger: 'page_load',
    valueMode: 'auto',
    contentName: 'Journalyze Premium',
  },
  {
    id: 'r_initiatecheckout',
    enabled: true,
    event: 'InitiateCheckout',
    pages: '/order, /checkout',
    trigger: 'pay_click',
    valueMode: 'auto',
  },
  {
    id: 'r_purchase',
    enabled: true,
    event: 'Purchase',
    pages: '/order, /checkout',
    trigger: 'payment_success',
    valueMode: 'auto',
  },
];

/* ════════════════════════════════════════════════════════════
   PARSING
   ════════════════════════════════════════════════════════════ */

function cloneDefaults(): PixelRule[] {
  return DEFAULT_PIXEL_RULES.map((r) => ({ ...r }));
}

export function parsePixelRules(raw: string | undefined): PixelRule[] {
  // Key belum ada → pakai aturan awal. Array kosong yang valid → memang tanpa aturan.
  if (raw === undefined || raw === null || raw === '') return cloneDefaults();
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return cloneDefaults();

    const out: PixelRule[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;

      const event = typeof o.event === 'string' ? o.event.trim() : '';
      if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(event)) continue;

      const trigger = o.trigger as PixelTriggerType;
      if (!TRIGGERS.includes(trigger)) continue;

      const pages = typeof o.pages === 'string' ? o.pages.trim() : '';
      if (!pages) continue; // aturan tanpa halaman diabaikan (jangan jadi "semua halaman")

      const valueMode: PixelValueMode = VALUE_MODES.includes(o.valueMode as PixelValueMode)
        ? (o.valueMode as PixelValueMode)
        : 'none';

      const rule: PixelRule = {
        id: typeof o.id === 'string' && o.id ? o.id : `r_${out.length}_${event}`,
        enabled: o.enabled !== false,
        event,
        pages,
        trigger,
        valueMode,
      };

      if (typeof o.selector === 'string' && o.selector.trim()) rule.selector = o.selector.trim();
      if (typeof o.scrollPercent === 'number' && Number.isFinite(o.scrollPercent)) {
        rule.scrollPercent = Math.min(100, Math.max(1, Math.round(o.scrollPercent)));
      }
      if (typeof o.value === 'number' && Number.isFinite(o.value) && o.value >= 0) rule.value = o.value;
      if (typeof o.contentName === 'string' && o.contentName.trim()) {
        rule.contentName = o.contentName.trim().slice(0, 100);
      }
      if (Array.isArray(o.targets)) {
        const t = o.targets.filter((x): x is string => typeof x === 'string' && x.length > 0);
        if (t.length > 0) rule.targets = t;
      }

      out.push(rule);
    }
    return out;
  } catch {
    return cloneDefaults();
  }
}

/**
 * Daftar analitik. Jika key 'pixel_analytics' belum ada, otomatis dimigrasi dari
 * pengaturan lama (pixel_id + pixel_enabled) supaya Pixel yang sudah tersimpan tidak hilang.
 */
export function parsePixelAnalytics(
  raw: string | undefined,
  legacyPixelId?: string,
  legacyEnabled?: boolean
): PixelAnalytics[] {
  if (raw === undefined || raw === null || raw === '') {
    const id = (legacyPixelId || '').trim();
    if (/^\d+$/.test(id)) {
      return [{ id: 'a_legacy', type: 'meta_pixel', name: 'Meta Pixel', pixelId: id, enabled: !!legacyEnabled }];
    }
    return [];
  }
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    const out: PixelAnalytics[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;

      const type = o.type as PixelAnalyticsType;
      if (!ANALYTICS_TYPES.includes(type)) continue;

      const pixelId = typeof o.pixelId === 'string' ? o.pixelId.trim() : '';
      if (!/^\d+$/.test(pixelId)) continue;

      const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Meta Pixel';

      out.push({
        id: typeof o.id === 'string' && o.id ? o.id : `a_${out.length}_${pixelId}`,
        type,
        name,
        pixelId,
        enabled: o.enabled !== false,
        ...(typeof o.testCode === 'string' && o.testCode.trim() ? { testCode: o.testCode.trim().slice(0, 40) } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function getActiveAnalytics(cfg: PixelConfig): PixelAnalytics[] {
  return cfg.analytics.filter((a) => a.enabled && /^\d+$/.test(a.pixelId));
}

/* ════════════════════════════════════════════════════════════
   CONFIG — cache di level module
   ════════════════════════════════════════════════════════════ */

let cachedConfig: PixelConfig | null = null;
let configPromise: Promise<PixelConfig> | null = null;

export function getCachedPixelConfig(): PixelConfig | null {
  return cachedConfig;
}

export function getPixelConfig(): Promise<PixelConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const { data, error } = await _sb
        .from('settings')
        .select('key, value')
        .in('key', ['pixel_id', 'pixel_enabled', 'pixel_analytics', 'pixel_rules']);
      if (error) throw error;

      const get = (k: string): string | undefined =>
        data?.find((r: { key: string; value: string }) => r.key === k)?.value;

      const cfg: PixelConfig = {
        analytics: parsePixelAnalytics(get('pixel_analytics'), get('pixel_id'), get('pixel_enabled') === 'true'),
        rules: parsePixelRules(get('pixel_rules')),
      };
      cachedConfig = cfg;
      return cfg;
    } catch {
      // Gagal fetch: jangan di-cache supaya bisa dicoba lagi
      return { analytics: [], rules: [] };
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

/* ════════════════════════════════════════════════════════════
   MODE UJI COBA (debug) — log event di layar lewat ?pixel_debug=1
   ════════════════════════════════════════════════════════════ */

export interface PixelDebugEntry {
  id: number;
  ts: number;
  kind: 'fired' | 'info';
  text: string;
  detail?: string;
}

let debugEntries: PixelDebugEntry[] = [];
let debugSeq = 0;
const debugListeners = new Set<() => void>();

export function isPixelDebugOn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem('pixel_debug') === '1';
  } catch {
    return false;
  }
}

export function setPixelDebug(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.sessionStorage.setItem('pixel_debug', '1');
    else window.sessionStorage.removeItem('pixel_debug');
  } catch {
    // abaikan
  }
}

function debugLog(kind: 'fired' | 'info', text: string, detail?: string) {
  if (!isPixelDebugOn()) return;
  debugEntries = [{ id: ++debugSeq, ts: Date.now(), kind, text, detail }, ...debugEntries].slice(0, 50);
  debugListeners.forEach((l) => l());
}

export function subscribePixelDebug(fn: () => void): () => void {
  debugListeners.add(fn);
  return () => {
    debugListeners.delete(fn);
  };
}

export function getPixelDebugEntries(): PixelDebugEntry[] {
  return debugEntries;
}

export function clearPixelDebug() {
  debugEntries = [];
  debugListeners.forEach((l) => l());
}

/* ════════════════════════════════════════════════════════════
   INJECT SCRIPT PIXEL (sekali) + INIT TIAP PIXEL ID
   ════════════════════════════════════════════════════════════ */

const initializedPixels = new Set<string>();

function ensurePixels(list: PixelAnalytics[]) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!document.getElementById('fb-pixel-script')) {
    const script = document.createElement('script');
    script.id = 'fb-pixel-script';
    // Hanya kode dasar fbevents — init & track dilakukan terpisah per Pixel ID dan per aturan.
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    `;
    document.head.appendChild(script);
  }

  if (!window.fbq) return;
  for (const a of list) {
    // Pixel ID wajib angka saja
    if (!/^\d+$/.test(a.pixelId) || initializedPixels.has(a.pixelId)) continue;
    window.fbq('init', a.pixelId);
    initializedPixels.add(a.pixelId);
  }
}

export function initPixel(cfg: PixelConfig) {
  const active = getActiveAnalytics(cfg);
  if (active.length > 0) ensurePixels(active);
}

/* ════════════════════════════════════════════════════════════
   PATH MATCHING
   ════════════════════════════════════════════════════════════ */

function normalizePath(p: string): string {
  const s = p.trim().toLowerCase();
  // /home dialihkan ke "/" di next.config, jadi keduanya dianggap halaman yang sama
  if (s === '/home' || s === '/home/') return '/';
  if (s.length > 1 && s.endsWith('/')) return s.slice(0, -1);
  return s;
}

export function pathMatches(patterns: string, path: string): boolean {
  const target = normalizePath(path);
  return patterns.split(',').some((raw) => {
    const pat = normalizePath(raw);
    if (!pat) return false;
    if (pat === '*') return true;
    if (pat.endsWith('*')) return target.startsWith(pat.slice(0, -1));
    return target === pat;
  });
}

// Admin bukan funnel iklan — tidak pernah dilacak
export function isExcludedPixelPath(path: string): boolean {
  return path.toLowerCase().startsWith('/admin');
}

/* ════════════════════════════════════════════════════════════
   KONTEKS HALAMAN (untuk nilai "Otomatis")
   Halaman seperti /upgrade & /order mengisi harga paket di sini.
   Hanya berlaku untuk path tempat konteks itu diset.
   ════════════════════════════════════════════════════════════ */

let pageContext: (PixelContextData & { path: string }) | null = null;

export function setPixelContext(ctx: PixelContextData) {
  if (typeof window === 'undefined') return;
  pageContext = { ...ctx, path: normalizePath(window.location.pathname) };
}

function getPageContext(path: string): PixelContextData | undefined {
  if (pageContext && pageContext.path === normalizePath(path)) return pageContext;
  return undefined;
}

/* ════════════════════════════════════════════════════════════
   MENJALANKAN ATURAN
   ════════════════════════════════════════════════════════════ */

function buildParams(rule: PixelRule, ctx?: PixelContextData): Record<string, unknown> | undefined {
  const params: Record<string, unknown> = {};

  let value: number | undefined;
  if (rule.valueMode === 'fixed' && typeof rule.value === 'number') {
    value = rule.value;
  } else if (rule.valueMode === 'auto' && ctx && typeof ctx.value === 'number') {
    value = ctx.value;
  }
  if (value !== undefined) {
    params.value = value;
    params.currency = 'IDR';
  }

  const name = rule.contentName || (rule.valueMode === 'auto' ? ctx?.content_name : undefined);
  if (name) params.content_name = name;
  if (rule.event === 'ViewContent') params.content_type = 'product';

  return Object.keys(params).length > 0 ? params : undefined;
}

function fireRule(
  rule: PixelRule,
  targets: PixelAnalytics[],
  ctx?: PixelContextData
): Record<string, unknown> | undefined {
  const params = buildParams(rule, ctx);
  if (typeof window === 'undefined' || !window.fbq) return params;

  const method = STANDARD_EVENTS.includes(rule.event) ? 'trackSingle' : 'trackSingleCustom';
  const eventId = ctx?.eventId;
  for (const a of targets) {
    if (eventId) {
      window.fbq(method, a.pixelId, rule.event, params || {}, { eventID: eventId });
    } else if (params) {
      window.fbq(method, a.pixelId, rule.event, params);
    } else {
      window.fbq(method, a.pixelId, rule.event);
    }
  }
  return params;
}

/**
 * Jalankan semua aturan aktif yang cocok dengan trigger + halaman saat ini.
 * Jika config sudah ada di cache, tidak ada await sebelum fbq dipanggil
 * (penting agar Purchase terkirim sebelum router.push).
 */
export async function runPixelTrigger(
  trigger: PixelTriggerType,
  ctx?: PixelContextData,
  filter?: (rule: PixelRule) => boolean
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (isExcludedPixelPath(path)) return;

    const cfg =
      cachedConfig ??
      (await Promise.race([
        getPixelConfig(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]));

    if (!cfg) {
      debugLog('info', 'Konfigurasi pixel belum termuat (timeout 2 detik)');
      return;
    }

    const active = getActiveAnalytics(cfg);
    if (active.length === 0) {
      debugLog('info', 'Tidak ada analitik aktif', 'Tambahkan analitik di admin dan pastikan statusnya ON.');
      return;
    }

    ensurePixels(active);
    const effectiveCtx = ctx ?? getPageContext(path);
    let matched = 0;

    for (const rule of cfg.rules) {
      if (!rule.enabled || rule.trigger !== trigger) continue;
      if (!pathMatches(rule.pages, path)) continue;
      if (filter && !filter(rule)) continue;
      matched++;

      const targets =
        rule.targets && rule.targets.length > 0 ? active.filter((a) => rule.targets!.includes(a.id)) : active;

      if (targets.length === 0) {
        debugLog('info', `Aturan ${rule.event} dilewati`, 'Analitik tujuan tidak aktif atau sudah dihapus.');
        continue;
      }

      const params = fireRule(rule, targets, effectiveCtx);
      debugLog(
        'fired',
        `${rule.event} → ${targets.map((t) => t.name).join(', ')}`,
        `${TRIGGER_NAMES[trigger]} · ${path}${params ? ' · ' + JSON.stringify(params) : ''}`
      );
    }

    if (matched === 0) {
      debugLog('info', `Tidak ada aturan aktif untuk "${TRIGGER_NAMES[trigger]}" di ${path}`);
    }
  } catch {
    // skip diam-diam
  }
}

/* ════════════════════════════════════════════════════════════
   HOOK — dipakai halaman yang punya titik trigger khusus
   (tombol bayar & pembayaran sukses)
   ════════════════════════════════════════════════════════════ */

export function usePixel() {
  const [config, setConfig] = useState<PixelConfig | null>(cachedConfig);
  const [loaded, setLoaded] = useState<boolean>(cachedConfig !== null);

  useEffect(() => {
    let cancelled = false;
    getPixelConfig().then((cfg) => {
      if (cancelled) return;
      initPixel(cfg);
      setConfig(cfg);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fireTrigger = useCallback(
    (trigger: PixelTriggerType, ctx?: PixelContextData) => runPixelTrigger(trigger, ctx),
    []
  );

  return { fireTrigger, config, loaded };
}
