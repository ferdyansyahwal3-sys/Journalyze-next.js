'use client';

// components/AffiliateTracker.tsx
// Di-inject di root layout — auto-detect ?ref= di semua halaman
// dan fire event granular per session per halaman.
//
// TAMBAHAN: tracking landing page utama untuk SEMUA pengunjung
// (dengan/ tanpa ?ref=) → tabel landing_events (dashboard admin).

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export const AFFILIATE_LS_KEY    = 'jz_affiliate_ref';
export const AFFILIATE_SESSION_KEY = 'jz_affiliate_session';
const AFFILIATE_EXPIRE_MS        = 30 * 24 * 60 * 60 * 1000; // 30 hari
const SESSION_TRACKED_PREFIX     = 'jz_aff_tracked_'; // + event key
const LP_UTM_KEY                 = 'jz_lp_utm';       // UTM first-touch per session

// ── Helpers localStorage ──────────────────────────────────────────────────

export function getAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(AFFILIATE_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code: string; savedAt: number };
    if (Date.now() - parsed.savedAt > AFFILIATE_EXPIRE_MS) {
      localStorage.removeItem(AFFILIATE_LS_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function saveAffiliateCode(code: string) {
  try {
    localStorage.setItem(
      AFFILIATE_LS_KEY,
      JSON.stringify({ code: code.toLowerCase(), savedAt: Date.now() })
    );
  } catch { /* noop */ }
}

/**
 * Ambil atau buat session_id unik per browser session.
 * Dipakai untuk trace 1 user journey end-to-end di admin panel.
 */
export function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem(AFFILIATE_SESSION_KEY);
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(AFFILIATE_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'unknown';
  }
}

function hasTracked(eventKey: string): boolean {
  try {
    return sessionStorage.getItem(SESSION_TRACKED_PREFIX + eventKey) === '1';
  } catch {
    return false;
  }
}

function markTracked(eventKey: string) {
  try {
    sessionStorage.setItem(SESSION_TRACKED_PREFIX + eventKey, '1');
  } catch { /* noop */ }
}

// ── UTM (first-touch per session) ────────────────────────────────────────

type UtmData = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

function saveUtmFromUrl(params: URLSearchParams) {
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (!source && !medium && !campaign) return; // tidak ada UTM → jangan timpa yang lama
  const data: UtmData = {};
  if (source)   data.utm_source = source;
  if (medium)   data.utm_medium = medium;
  if (campaign) data.utm_campaign = campaign;
  try {
    sessionStorage.setItem(LP_UTM_KEY, JSON.stringify(data));
  } catch { /* noop */ }
}

function readUtm(): UtmData {
  try {
    const raw = sessionStorage.getItem(LP_UTM_KEY);
    return raw ? (JSON.parse(raw) as UtmData) : {};
  } catch {
    return {};
  }
}

// ── Fire event: tracking landing page (semua pengunjung) ─────────────────

export async function fireLandingEvent(
  eventType: 'landing_view' | 'cta_click',
  extra?: { plan_type?: string }
) {
  try {
    await fetch('/api/track/landing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // tetap terkirim walau halaman langsung pindah (klik CTA → /order)
      body: JSON.stringify({
        event_type:     eventType,
        session_id:     getOrCreateSessionId(),
        affiliate_code: getAffiliateCode(),
        referrer:       typeof document !== 'undefined' ? document.referrer || null : null,
        plan_type:      extra?.plan_type || null,
        ...readUtm(),
      }),
    });
  } catch {
    // tracking gagal tidak mengganggu UX
  }
}

// ── Fire event ke API affiliate ──────────────────────────────────────────

export async function fireEvent(
  affiliateCode: string,
  eventType: 'landing_view' | 'cta_click' | 'order_view' | 'plan_select' | 'checkout_start' | 'view' | 'click',
  page: 'landing' | 'order',
  extra?: { plan_type?: string }
) {
  try {
    const sessionId = getOrCreateSessionId();
    await fetch('/api/affiliate/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        affiliate_code: affiliateCode,
        event_type:     eventType,
        page,
        referrer:   typeof document !== 'undefined' ? document.referrer || null : null,
        session_id: sessionId,
        plan_type:  extra?.plan_type || null,
      }),
    });
  } catch {
    // tracking gagal tidak mengganggu UX
  }
}

// ── Komponen Inner ───────────────────────────────────────────────────────

function TrackerInner() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isLanding = pathname === '/' || pathname === '/home';
    const isOrder   = pathname === '/order';

    if (!isLanding && !isOrder) return;

    // Simpan kode dari ?ref= ke localStorage
    const refFromUrl = searchParams.get('ref');
    if (refFromUrl?.trim()) {
      saveAffiliateCode(refFromUrl.trim().toLowerCase());
    }

    // ── Landing page utama: SEMUA pengunjung (organik, UTM, affiliate) ──
    if (isLanding) {
      saveUtmFromUrl(searchParams);
      if (!hasTracked('lp_view')) {
        markTracked('lp_view');
        fireLandingEvent('landing_view');
      }
    }

    // ── Funnel affiliate: hanya jika ada kode affiliate ──
    const code = getAffiliateCode();
    if (!code) return;

    // Fire event sekali per session per halaman
    if (isLanding) {
      if (!hasTracked('landing_view')) {
        markTracked('landing_view');
        fireEvent(code, 'landing_view', 'landing');
      }
    }

    if (isOrder) {
      if (!hasTracked('order_view')) {
        markTracked('order_view');
        fireEvent(code, 'order_view', 'order');
      }
    }
  }, [pathname, searchParams]);

  return null;
}

// Dibungkus Suspense karena useSearchParams() butuh Suspense boundary
export default function AffiliateTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  );
}