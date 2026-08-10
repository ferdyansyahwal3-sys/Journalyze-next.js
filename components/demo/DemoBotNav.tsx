'use client';
/**
 * components/demo/DemoBotNav.tsx
 * Bottom nav mobile untuk demo — sama dengan BottomNav journal
 * tapi tanpa logout di more drawer.
 */

import { useState } from 'react';
import { useJournalStore, type JournalPage, BN_MAIN, BN_MORE } from '@/store/useJournalStore';

const PAGE_ICONS: Record<JournalPage, string> = {
  home:    '🏠',
  risk:    '⚖️',
  plan:    '📈',
  data:    '📋',
  filter:  '🔍',
  weekly:  '📅',
  monthly: '🗓',
  news:    '📰',
};

const PAGE_LABELS: Record<JournalPage, string> = {
  home:    'Home',
  risk:    'Risk',
  plan:    'Plan',
  data:    'Data',
  filter:  'Filter',
  weekly:  'Weekly',
  monthly: 'Monthly',
  news:    'News',
};

export default function DemoBotNav() {
  const activePage    = useJournalStore(s => s.activePage);
  const setActivePage = useJournalStore(s => s.setActivePage);
  const theme         = useJournalStore(s => s.theme);
  const setTheme      = useJournalStore(s => s.setTheme);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMore = BN_MORE.includes(activePage);

  return (
    <>
      {/* Overlay */}
      {drawerOpen && (
        <div
          className="bn-overlay show"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer */}
      <div className={`bn-more-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="bn-drawer-handle" />
        <div className="bn-drawer-title">Menu Lainnya</div>

        <div className="bn-drawer-grid">
          {BN_MORE.map(page => (
            <button
              key={page}
              className={`bn-drawer-item${activePage === page ? ' active' : ''}`}
              onClick={() => { setActivePage(page); setDrawerOpen(false); }}
              type="button"
            >
              <span className="bn-drawer-icon">{PAGE_ICONS[page]}</span>
              {PAGE_LABELS[page]}
            </button>
          ))}
        </div>

        {/* Theme toggle di drawer */}
        <div className="bn-drawer-theme">
          <span className="bn-drawer-theme-label">Tema</span>
          <div className="bn-theme-pill">
            <button
              className={`bn-topt${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
              type="button"
            >
              🌙 Dark
            </button>
            <button
              className={`bn-topt${theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')}
              type="button"
            >
              ☀️ Light
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="bot-nav">
        {BN_MAIN.map(page => (
          <button
            key={page}
            className={`bn-btn${activePage === page ? ' active' : ''}`}
            onClick={() => setActivePage(page)}
            type="button"
          >
            <div className="bn-icon-wrap">
              <span className="bn-icon">{PAGE_ICONS[page]}</span>
            </div>
            <span className="bn-label">{PAGE_LABELS[page]}</span>
          </button>
        ))}

        {/* More button */}
        <button
          className={`bn-btn${isMore ? ' active' : ''}`}
          onClick={() => setDrawerOpen(v => !v)}
          type="button"
        >
          <div className="bn-icon-wrap">
            <span className="bn-icon">☰</span>
          </div>
          <span className="bn-label">More</span>
        </button>
      </nav>
    </>
  );
}