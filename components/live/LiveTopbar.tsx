'use client';
/**
 * components/live/LiveTopbar.tsx
 * Phase 10
 *
 * Markup 1:1 dengan topbar di live.html:
 * - .topbar → .brand-logo → .page-tabs (.ptab) → .theme-pill
 * - Tidak ada user badge / logout / API key button
 * - Tab sama dengan JournalApp tapi hanya untuk live pages
 */

import type { LiveTab } from './LiveApp';
import type { LiveProfile } from '../../lib/publicData';

interface Props {
  activeTab: LiveTab;
  setActiveTab: (t: LiveTab) => void;
  profile: LiveProfile;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

const TABS: { id: LiveTab; label: string }[] = [
  { id: 'home',    label: 'Home' },
  { id: 'data',    label: 'Data' },
  { id: 'filter',  label: 'Filter' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function LiveTopbar({ activeTab, setActiveTab, profile, theme, setTheme }: Props) {
  return (
    <div className="topbar">
      {/* Brand */}
      <div className="brand-logo">
        Journal<em>yze</em>
        <span className="brand-tag" style={{ marginLeft: 8 }}>Live</span>
      </div>

      {/* Page tabs */}
      <div className="page-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`ptab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Right side: live badge + theme pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span className="live-badge">Live</span>

        {/* Theme toggle — sama dengan .theme-pill di live.html */}
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