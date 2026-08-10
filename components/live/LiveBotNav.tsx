'use client';
/**
 * components/live/LiveBotNav.tsx
 * Phase 10
 *
 * Bottom nav mobile — markup 1:1 dengan .bot-nav di live.html.
 * Hanya 5 tab utama, tidak ada "more" drawer karena tidak ada
 * halaman tambahan (Plan, Risk, News tidak ada di live view).
 */

import type { LiveTab } from './LiveApp';

interface Props {
  activeTab: LiveTab;
  setActiveTab: (t: LiveTab) => void;
}

const BOT_TABS: { id: LiveTab; icon: string; label: string }[] = [
  { id: 'home',    icon: '🏠', label: 'Home' },
  { id: 'data',    icon: '📋', label: 'Data' },
  { id: 'filter',  icon: '🔍', label: 'Filter' },
  { id: 'weekly',  icon: '📅', label: 'Weekly' },
  { id: 'monthly', icon: '🗓', label: 'Monthly' },
];

export function LiveBotNav({ activeTab, setActiveTab }: Props) {
  return (
    <nav className="bot-nav">
      {BOT_TABS.map((t) => (
        <button
          key={t.id}
          className={`bn-btn${activeTab === t.id ? ' active' : ''}`}
          onClick={() => setActiveTab(t.id)}
          type="button"
        >
          <div className="bn-icon-wrap">
            <span className="bn-icon">{t.icon}</span>
          </div>
          <span className="bn-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}