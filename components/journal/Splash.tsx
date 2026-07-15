// components/journal/Splash.tsx
// Dipindah dari index.html baris 1537-1573 (markup) + 3346-3352 (logic auto-close 6s)
'use client';

import { useEffect } from 'react';
import { useJournalStore } from '@/store/useJournalStore';

export default function Splash() {
  const splashHiding = useJournalStore((s) => s.splashHiding);
  const splashHidden = useJournalStore((s) => s.splashHidden);
  const closeSplash = useJournalStore((s) => s.closeSplash);

  useEffect(() => {
    const t = setTimeout(closeSplash, 6000); // index.html baris 3352
    return () => clearTimeout(t);
  }, [closeSplash]);

  if (splashHidden) return null;

  return (
    <div id="splash" className={splashHiding ? 'hide' : ''}>
      <div className="sp-orb-l"></div>
      <div className="sp-orb-r"></div>
      <div className="sp-orb-c"></div>

      <div className="sp-brk tl"></div>
      <div className="sp-brk tr"></div>
      <div className="sp-brk bl"></div>
      <div className="sp-brk br"></div>

      <div className="sp-bar"></div>

      <div className="sp-body">
        <div className="sp-eyebrow">Trading Journal Suite</div>
        <div className="sp-logo">
          Journal<em>yze</em>
        </div>
        <div className="sp-tagline">
          Catat. Analisa. Berkembang.
          <br />
          Jurnal trading pribadi yang membangun disiplin kamu.
        </div>
        <div className="sp-divider">
          <span className="sp-divider-gem">✦</span>
        </div>
        <button className="sp-cta" onClick={closeSplash}>
          Masuk ke Jurnal
        </button>
        <div className="sp-skip" onClick={closeSplash}>
          Klik untuk mulai
        </div>
      </div>
    </div>
  );
}