'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from './siteData';

export default function SiteNavbar() {
  const pathname   = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Scroll listener
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Escape key + kunci scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // Tutup panel saat rute berubah
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <nav
        className={`st-nav${scrolled ? ' st-nav--scrolled' : ''}`}
        aria-label="Navigasi utama"
      >
        <div className="st-nav-inner">
          {/* Logo */}
          <a href="/" className="st-nav-logo" aria-label="Journalyze — Beranda">
            <span style={{ color: 'var(--text)' }}>Journal</span>
            <em style={{ color: 'var(--gold2)' }}>yze</em>
          </a>

          {/* Link tengah (desktop) */}
          <ul className="st-nav-links" role="list">
            {NAV_LINKS.map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className={`st-nav-link${isActive(l.href) ? ' st-active' : ''}`}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Kanan (desktop) */}
          <div className="st-nav-right">
            <a href="/journal" className="st-nav-masuk">Masuk</a>
            <a href="/demo" className="st-btn st-btn-gold st-btn-sm" aria-label="Coba demo gratis Journalyze">
              Coba Gratis
            </a>
          </div>

          {/* Burger (mobile) */}
          <button
            className={`st-nav-burger${open ? ' st-open' : ''}`}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="st-nav-panel"
            onClick={() => setOpen(v => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Spacer agar konten tidak tertutup nav fixed */}
      <div className="st-nav-spacer" aria-hidden="true" />

      {/* Panel mobile */}
      <div
        id="st-nav-panel"
        ref={panelRef}
        className={`st-nav-panel${open ? ' st-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        onClick={e => { if (e.target === panelRef.current) setOpen(false); }}
      >
        {NAV_LINKS.map(l => (
          <a
            key={l.href}
            href={l.href}
            className={`st-nav-panel-link${isActive(l.href) ? ' st-active' : ''}`}
            aria-current={isActive(l.href) ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </a>
        ))}

        <div className="st-nav-panel-divider" aria-hidden="true" />

        <a href="/journal" className="st-nav-panel-link" onClick={() => setOpen(false)}>
          Masuk
        </a>
        <a href="/demo" className="st-nav-panel-link" onClick={() => setOpen(false)}>
          Coba Gratis
        </a>
      </div>
    </>
  );
}
