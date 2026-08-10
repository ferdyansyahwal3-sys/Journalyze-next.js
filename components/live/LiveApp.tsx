'use client';
/**
 * components/live/LiveApp.tsx
 * Phase 10
 *
 * Orchestrator untuk /live route.
 * Analog dengan JournalApp.tsx tapi:
 * - userId dari URL ?uid=... bukan dari auth
 * - Tidak ada Zustand journal store
 * - Semua page dalam mode read-only
 * - useLiveData hook untuk fetch + filter state
 *
 * Struktur HTML output:
 *   <div data-theme="...">
 *     <LiveTopbar />
 *     <div class="live-readonly-bar">...</div>
 *     <main class="main">
 *       <LivePage* />
 *     </main>
 *     <LiveBotNav /> ← mobile only (CSS handles display:none on desktop)
 *   </div>
 */

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useLiveData } from '../../hooks/useLiveData';
import { LiveTopbar }         from './LiveTopbar';
import { LiveBotNav }         from './LiveBotNav';
import { LivePageHome }       from './LivePageHome';
import { LivePageData }       from './LivePageData';
import { LivePageFilter }     from './LivePageFilter';
import { LivePageWeekly }     from './LivePageWeekly';
import { LivePageMonthly }    from './LivePageMonthly';
import { LiveErrorState }     from './LiveErrorState';
import { LiveLoadingSkeleton } from './LiveLoadingSkeleton';

export type LiveTab = 'home' | 'data' | 'filter' | 'weekly' | 'monthly';

export default function LiveApp() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('uid');

  const [activeTab, setActiveTab] = useState<LiveTab>('home');

  const live = useLiveData(userId);

  // ── Guard: tidak ada uid ──────────────────────────────────────────────────
  if (!userId) {
    return (
      <LiveErrorState
        icon="🔗"
        title="Link tidak valid"
        message="URL harus mengandung parameter ?uid= yang valid. Minta link yang benar dari pemilik journal."
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (live.loading) {
    return <LiveLoadingSkeleton />;
  }

  // ── Guard: profil tidak ditemukan / live mode off ─────────────────────────
  if (!live.profile || live.profileError) {
    return (
      <LiveErrorState
        icon="🔒"
        title="Live tidak tersedia"
        message={
          live.profileError ??
          'Trader ini belum mengaktifkan Live Mode atau link tidak valid.'
        }
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Topbar desktop */}
      <LiveTopbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={live.profile}
        theme={live.theme}
        setTheme={live.setTheme}
      />

      {/* Read-only hint bar — di bawah topbar, di atas konten */}
      <div className="live-readonly-bar">
        <span>👁</span>
        <span>
          Tampilan <strong>read-only</strong> · Journal milik{' '}
          <strong>{live.profile.display_name ?? 'Trader'}</strong>
        </span>
        <span className="live-badge">Live</span>
      </div>

      {/* Main content */}
      <main className="main">
        {activeTab === 'home' && (
          <LivePageHome
            trades={live.trades}
            weeklyReviews={live.weeklyReviews}
            monthlyReviews={live.monthlyReviews}
            profile={live.profile}
          />
        )}
        {activeTab === 'data' && (
          <LivePageData trades={live.filteredTrades} />
        )}
        {activeTab === 'filter' && (
          <LivePageFilter
            trades={live.trades}
            filteredTrades={live.filteredTrades}
            uniquePairs={live.uniquePairs}
            filterPair={live.filterPair}
            filterDir={live.filterDir}
            filterResult={live.filterResult}
            filterDateFrom={live.filterDateFrom}
            filterDateTo={live.filterDateTo}
            setFilterPair={live.setFilterPair}
            setFilterDir={live.setFilterDir}
            setFilterResult={live.setFilterResult}
            setFilterDateFrom={live.setFilterDateFrom}
            setFilterDateTo={live.setFilterDateTo}
            onReset={live.resetFilters}
          />
        )}
        {activeTab === 'weekly' && (
          <LivePageWeekly
            trades={live.trades}
            weeklyReviews={live.weeklyReviews}
          />
        )}
        {activeTab === 'monthly' && (
          <LivePageMonthly
            trades={live.trades}
            monthlyReviews={live.monthlyReviews}
          />
        )}
      </main>

      {/* Bottom nav — mobile only, CSS: display:none di desktop */}
      <LiveBotNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}