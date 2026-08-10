'use client';
/**
 * components/demo/DemoTopbar.tsx
 * Topbar untuk demo mode — sama dengan Topbar journal
 * tapi tanpa user badge, tanpa logout, tanpa API key button.
 * Ada badge "DEMO" di kanan.
 */

import { useJournalStore, type JournalPage, BN_MAIN, BN_MORE } from '@/store/useJournalStore';

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

const ALL_TABS: JournalPage[] = [...BN_MAIN, ...BN_MORE];

export default function DemoTopbar() {
  const activePage    = useJournalStore(s => s.activePage);
  const setActivePage = useJournalStore(s => s.setActivePage);
  const theme         = useJournalStore(s => s.theme);
  const setTheme      = useJournalStore(s => s.setTheme);

  return (
    <div className="topbar">
      {/* Brand */}
      <div className="brand-logo">
        Journal<em>yze</em>
        <span className="brand-tag" style={{ marginLeft: 8 }}>Demo</span>
      </div>

      {/* Page tabs */}
      <div className="page-tabs">
        {ALL_TABS.map(page => (
          <button
            key={page}
            className={`ptab${activePage === page ? ' active' : ''}`}
            onClick={() => setActivePage(page)}
            type="button"
          >
            {PAGE_LABELS[page]}
          </button>
        ))}
      </div>

      {/* Right: Demo badge + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Demo badge */}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: 'var(--gold2)',
          background: 'var(--gold-bg)',
          border: '1px solid var(--gold-bd)',
          borderRadius: 99,
          padding: '3px 10px',
          fontWeight: 700,
        }}>
          🧪 Demo
        </span>

        {/* Theme toggle */}
        <div className="theme-pill">
          <button
            className={`topt${theme === 'dark' ? ' active' : ''}`}
            onClick={() => setTheme('dark')}
            type="button"
          >
            🌙
          </button>
          <button
            className={`topt${theme === 'light' ? ' active' : ''}`}
            onClick={() => setTheme('light')}
            type="button"
          >
            ☀️
          </button>
        </div>
      </div>
    </div>
  );
}