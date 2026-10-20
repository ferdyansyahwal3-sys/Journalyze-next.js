'use client';

/**
 * SiteLoader.tsx
 * Tampil sekali per sesi (flag sessionStorage jz_site_loaded).
 * Tidak muncul di route app (/journal, /demo, /admin, dst).
 * Animasi: counter 0→100 selama 1.8s, exit translateY(-100%).
 */

import { useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'jz_site_loaded';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function SiteLoader() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const barRef     = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const rafRef     = useRef<number>(0);

  useEffect(() => {
    // Sudah ditampilkan di sesi ini → skip
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) return;

    setVisible(true);

    // Kunci scroll
    document.body.style.overflow = 'hidden';

    const DURATION   = 1800; // ms
    const MIN_SHOW   = 1200; // ms minimum meski halaman sudah siap
    const start      = performance.now();
    let docReady     = document.readyState === 'complete';
    let rafStopped   = false;

    const onReady = () => { docReady = true; };
    if (!docReady) window.addEventListener('load', onReady);

    const tick = (now: number) => {
      if (rafStopped) return;
      const elapsed = now - start;
      const raw      = Math.min(elapsed / DURATION, 1);
      const eased    = easeInOutCubic(raw);
      const pct      = Math.round(eased * 100);

      setProgress(pct);
      if (barRef.current)     barRef.current.style.width     = `${pct}%`;
      if (counterRef.current) counterRef.current.textContent = String(pct).padStart(3, '0');

      if (raw < 1 || (!docReady && elapsed < MIN_SHOW)) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Jeda singkat setelah 100%
        setTimeout(() => {
          rafStopped = true;
          setExiting(true);
          document.body.style.overflow = '';
          // Hapus dari DOM setelah transisi selesai
          setTimeout(() => {
            setVisible(false);
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
          }, 700);
        }, 200);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      rafStopped = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('load', onReady);
      document.body.style.overflow = '';
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* noscript: sembunyikan loader jika JS mati */}
      <noscript>
        <style>{'.st-ld{display:none}'}</style>
      </noscript>

      <div
        className={`st-ld${exiting ? ' st-ld--exit' : ''}`}
        role="status"
        aria-live="polite"
        aria-label="Memuat Journalyze"
      >
        <div className="st-ld-svg-wrap">
          <svg
            viewBox="0 0 240 160"
            width="240"
            height="160"
            xmlns="http://www.w3.org/2000/svg"
            className="st-ld-glow"
            aria-hidden="true"
          >
            <defs>
              {/* Gradien gold */}
              <linearGradient id="st-ld-grad-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--gold3,  #F5D87A)" />
                <stop offset="50%"  stopColor="var(--gold,   #C9A84C)" />
                <stop offset="100%" stopColor="var(--gold2,  #E8C567)" />
              </linearGradient>

              {/* Gradien silver */}
              <linearGradient id="st-ld-grad-silver" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--st-silver1, #F2F2F0)" />
                <stop offset="50%"  stopColor="var(--st-silver2, #C9CBCE)" />
                <stop offset="100%" stopColor="var(--st-silver3, #8E9196)" />
              </linearGradient>

              {/* Gradien kilau diagonal */}
              <linearGradient id="st-ld-grad-sheen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
                <stop offset="50%"  stopColor="rgba(255,255,255,0.35)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>

              {/* Clip paths per badan candle */}
              <clipPath id="st-ld-clip-left">
                <rect x="49" y="80" width="22" height="36" rx="3" />
              </clipPath>
              <clipPath id="st-ld-clip-mid">
                <rect x="109" y="36" width="22" height="88" rx="3" />
              </clipPath>
              <clipPath id="st-ld-clip-right">
                <rect x="169" y="58" width="22" height="58" rx="3" />
              </clipPath>
            </defs>

            {/* Garis dasar */}
            <line
              className="st-ld-baseline"
              x1="30" y1="130"
              x2="210" y2="130"
            />

            {/* ── Candle Kiri (gold) ── */}
            {/* Wick atas */}
            <line className="st-ld-wick st-ld-wick-left" x1="60" y1="68" x2="60" y2="80" />
            {/* Badan */}
            <rect
              className="st-ld-breathe-left"
              x="49" y="80" width="22" height="36" rx="3"
              fill="url(#st-ld-grad-gold)"
              stroke="var(--gold-bd2, rgba(201,168,76,0.32))"
              strokeWidth="0.8"
              style={{ transformOrigin: '60px 116px' }}
            />
            {/* Highlight metalik */}
            <rect
              className="st-ld-highlight st-ld-highlight-left"
              x="51" y="82" width="4" height="32" rx="2"
              fill="url(#st-ld-grad-sheen)"
              clipPath="url(#st-ld-clip-left)"
              style={{ transformOrigin: '60px 116px' }}
            />
            {/* Wick bawah */}
            <line className="st-ld-wick st-ld-wick-left" x1="60" y1="116" x2="60" y2="126" />

            {/* ── Candle Tengah (silver, tertinggi) ── */}
            <line className="st-ld-wick st-ld-wick-mid" x1="120" y1="16" x2="120" y2="36" />
            <rect
              className="st-ld-breathe-mid"
              x="109" y="36" width="22" height="88" rx="3"
              fill="url(#st-ld-grad-silver)"
              stroke="var(--st-silver3, #8E9196)"
              strokeWidth="0.8"
              style={{ transformOrigin: '120px 124px' }}
            />
            <rect
              className="st-ld-highlight st-ld-highlight-mid"
              x="111" y="38" width="4" height="84" rx="2"
              fill="url(#st-ld-grad-sheen)"
              clipPath="url(#st-ld-clip-mid)"
              style={{ transformOrigin: '120px 124px' }}
            />
            <line className="st-ld-wick st-ld-wick-mid" x1="120" y1="124" x2="120" y2="130" />

            {/* ── Candle Kanan (gold) ── */}
            <line className="st-ld-wick st-ld-wick-right" x1="180" y1="44" x2="180" y2="58" />
            <rect
              className="st-ld-breathe-right"
              x="169" y="58" width="22" height="58" rx="3"
              fill="url(#st-ld-grad-gold)"
              stroke="var(--gold-bd2, rgba(201,168,76,0.32))"
              strokeWidth="0.8"
              style={{ transformOrigin: '180px 116px' }}
            />
            <rect
              className="st-ld-highlight st-ld-highlight-right"
              x="171" y="60" width="4" height="54" rx="2"
              fill="url(#st-ld-grad-sheen)"
              clipPath="url(#st-ld-clip-right)"
              style={{ transformOrigin: '180px 116px' }}
            />
            <line className="st-ld-wick st-ld-wick-right" x1="180" y1="116" x2="180" y2="128" />

            {/* Kilau diagonal — muncul sekali di t=1.2s */}
            <rect
              className="st-ld-sheen"
              x="0" y="0" width="60" height="160"
              fill="url(#st-ld-grad-sheen)"
            />
          </svg>
        </div>

        {/* Logo + progress */}
        <div className="st-ld-foot">
          <div className="st-ld-logo">
            Journal<em>yze</em>
          </div>

          <div className="st-ld-meter">
            <div className="st-ld-bar-track">
              <div className="st-ld-bar-fill" ref={barRef} />
            </div>
            <div className="st-ld-labels">
              <span className="st-ld-text-left">MEMUAT</span>
              <span className="st-ld-counter" ref={counterRef}>000</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
