'use client';

// components/PixelTracker.tsx
// Dipasang SEKALI di app/layout.tsx. Menjalankan aturan Meta Pixel dari admin:
//  - trigger "Halaman dibuka"  → saat path berubah
//  - trigger "Elemen diklik"   → satu listener klik global
//  - trigger "Scroll"          → listener scroll per halaman
// Trigger "tombol bayar" & "pembayaran sukses" dipanggil dari halaman /order & /checkout.
// /admin tidak pernah dilacak.
// Mode uji coba: tambahkan ?pixel_debug=1 di URL untuk melihat log event di layar
// (?pixel_debug=0 untuk mematikan).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearPixelDebug,
  getActiveAnalytics,
  getCachedPixelConfig,
  getPixelConfig,
  getPixelDebugEntries,
  initPixel,
  isExcludedPixelPath,
  isPixelDebugOn,
  pathMatches,
  runPixelTrigger,
  setPixelDebug,
  subscribePixelDebug,
} from '@/hooks/usePixel';
import type { PixelDebugEntry } from '@/hooks/usePixel';

function clickMatches(target: Element, selector: string): boolean {
  try {
    const s = selector.trim();
    if (s.toLowerCase().startsWith('text:')) {
      const needle = s.slice(5).trim().toLowerCase();
      if (!needle) return false;
      const el = target.closest('a,button,[role="button"],input[type="submit"]');
      if (!el) return false;
      const text = (el.textContent || (el as HTMLInputElement).value || '').toLowerCase();
      return text.includes(needle);
    }
    return !!target.closest(s);
  } catch {
    return false; // selector tidak valid → abaikan
  }
}

/* ── Overlay uji coba ── */

const EMPTY_ENTRIES: PixelDebugEntry[] = [];
const getServerEntries = () => EMPTY_ENTRIES;

function DebugOverlay({ onClose }: { onClose: () => void }) {
  const entries = useSyncExternalStore(subscribePixelDebug, getPixelDebugEntries, getServerEntries);

  const time = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString('id-ID', { hour12: false });
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        width: 'min(400px, calc(100vw - 24px))',
        maxHeight: '45vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10,10,10,0.96)',
        border: '1px solid rgba(201,168,76,0.5)',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        zIndex: 2147483000,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: '#F8F4EC',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(201,168,76,0.25)',
        }}
      >
        <strong style={{ color: '#E8C567', letterSpacing: 1 }}>🧪 PIXEL DEBUG</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={clearPixelDebug}
            style={{ background: 'transparent', border: '1px solid #444', color: '#C8C0B0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
          >
            Bersihkan
          </button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: '1px solid #444', color: '#C8C0B0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
          >
            ✕ Tutup
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: '6px 12px 10px' }}>
        {entries.length === 0 ? (
          <div style={{ color: '#6A6050', padding: '8px 0' }}>
            Belum ada event. Buka halaman lain, klik, atau scroll sesuai aturan.
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: e.kind === 'fired' ? '#22C55E' : '#E8C567' }}>{e.kind === 'fired' ? '●' : '○'}</span>
                <span style={{ color: '#6A6050' }}>{time(e.ts)}</span>
                <span style={{ fontWeight: 700 }}>{e.text}</span>
              </div>
              {e.detail && (
                <div style={{ color: '#8A8070', marginLeft: 14, wordBreak: 'break-all', lineHeight: 1.5 }}>{e.detail}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PixelTracker() {
  const pathname = usePathname();
  const firedPathRef = useRef<string | null>(null);
  const [debugOn, setDebugOn] = useState(false);

  // ── Mode uji coba: baca ?pixel_debug= (harus dideklarasikan lebih dulu agar aktif sebelum event pertama) ──
  useEffect(() => {
    try {
      const flag = new URLSearchParams(window.location.search).get('pixel_debug');
      if (flag === '1') setPixelDebug(true);
      else if (flag === '0') setPixelDebug(false);
    } catch {
      // abaikan
    }
    setDebugOn(isPixelDebugOn());
  }, []);

  // ── Klik: satu listener global, aturan dibaca dari cache saat klik terjadi ──
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const cfg = getCachedPixelConfig();
      if (!cfg || getActiveAnalytics(cfg).length === 0) return;

      const path = window.location.pathname;
      if (isExcludedPixelPath(path)) return;

      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      const ids = new Set<string>();
      for (const rule of cfg.rules) {
        if (!rule.enabled || rule.trigger !== 'click' || !rule.selector) continue;
        if (!pathMatches(rule.pages, path)) continue;
        if (clickMatches(target, rule.selector)) ids.add(rule.id);
      }
      if (ids.size > 0) runPixelTrigger('click', undefined, (r) => ids.has(r.id));
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // ── Halaman dibuka + scroll: jalan tiap path berubah ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let removeScroll: (() => void) | undefined;

    // setTimeout 0 supaya efek halaman (mis. setPixelContext) selesai lebih dulu
    const timer = setTimeout(async () => {
      const path = window.location.pathname;
      if (isExcludedPixelPath(path)) return;

      const cfg = await getPixelConfig();
      if (cancelled) return;

      // Cegah kirim ganda untuk path yang sama (mis. React StrictMode di dev)
      if (firedPathRef.current === path) return;
      firedPathRef.current = path;

      initPixel(cfg);
      runPixelTrigger('page_load');

      // Aturan scroll untuk halaman ini (hanya jika ada analitik aktif)
      if (getActiveAnalytics(cfg).length === 0) return;
      const scrollRules = cfg.rules.filter(
        (r) => r.enabled && r.trigger === 'scroll' && pathMatches(r.pages, path)
      );
      if (scrollRules.length > 0) {
        const fired = new Set<string>();

        const check = () => {
          const doc = document.documentElement;
          const scrollable = doc.scrollHeight - window.innerHeight;
          // Halaman yang tidak bisa di-scroll dianggap belum mencapai kedalaman apa pun
          const pct = scrollable <= 0 ? 0 : (window.scrollY / scrollable) * 100;

          const due = scrollRules.filter(
            (r) => !fired.has(r.id) && pct >= (r.scrollPercent ?? 50)
          );
          if (due.length > 0) {
            due.forEach((r) => fired.add(r.id));
            const ids = new Set(due.map((r) => r.id));
            runPixelTrigger('scroll', undefined, (r) => ids.has(r.id));
          }
        };

        window.addEventListener('scroll', check, { passive: true });
        removeScroll = () => window.removeEventListener('scroll', check);
        check();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (removeScroll) removeScroll();
    };
  }, [pathname]);

  if (!debugOn || isExcludedPixelPath(pathname || '')) return null;

  return (
    <DebugOverlay
      onClose={() => {
        setPixelDebug(false);
        setDebugOn(false);
      }}
    />
  );
}
