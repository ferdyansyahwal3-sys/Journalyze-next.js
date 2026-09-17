'use client';
/**
 * components/demo/DemoApp.tsx
 * Phase 11 — Full journal experience, tanpa auth, tanpa cloud save.
 *
 * Bedanya dari JournalApp:
 * 1. Tidak ada AuthOverlay / Splash
 * 2. Tidak ada useJournalAuth — userId selalu null
 * 3. Semua operasi store (addTrade, updateTrade, dll) tetap jalan
 *    tapi karena userId=null, tidak ada yang ke Supabase
 * 4. Data tersimpan di localStorage (persistLocal sudah dipanggil di store)
 * 5. Ada DemoBanner di atas
 * 6. Topbar & BottomNav diganti versi demo (tanpa login/logout)
 */

import { useEffect } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import PageHome    from '@/components/journal/PageHome';
import PageRisk    from '@/components/journal/PageRisk';
import PagePlan    from '@/components/journal/PagePlan';
import PageData    from '@/components/journal/PageData';
import PageFilter  from '@/components/journal/PageFilter';
import PageWeekly  from '@/components/journal/PageWeekly';
import PageMonthly from '@/components/journal/PageMonthly';
import PageNews    from '@/components/journal/PageNews';
import DemoTopbar  from './DemoTopbar';
import DemoBotNav  from './DemoBotNav';
import DemoBanner  from './DemoBanner';
import Toast       from '@/components/journal/Toast';
import ConfirmModal from '@/components/journal/ConfirmModal';

const BANNER_HEIGHT = 37; // harus sama dengan di DemoBanner.tsx

export default function DemoApp() {
  const activePage    = useJournalStore(s => s.activePage);
  const setActivePage = useJournalStore(s => s.setActivePage);

  const switchPage = (page: string) => setActivePage(page as JournalPage);

  useEffect(() => {
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });

    useJournalStore.setState({ currentUser: null, authOverlayVisible: false });

    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);
  }, []);

  return (
    <>
      {/* Banner demo — fixed di paling atas, spacer sudah ada di dalam DemoBanner */}
      <DemoBanner />

      {/* Topbar versi demo — digeser ke bawah banner dengan style override */}
      <div style={{ position: 'sticky', top: BANNER_HEIGHT, zIndex: 300 }}>
        <DemoTopbar />
      </div>

      {/* Main content */}
      <div className={`main ${activePage === 'home' ? 'home-active' : ''}`}>
        <PageHome
          active={activePage === 'home'}
          switchPage={switchPage}
          openApiKeyModal={() => {}}
          hideBonus
        />
        <PageRisk    active={activePage === 'risk'} />
        <PagePlan    active={activePage === 'plan'}    switchPage={switchPage} />
        <PageData    active={activePage === 'data'} />
        <PageFilter  active={activePage === 'filter'} />
        <PageWeekly  active={activePage === 'weekly'} />
        <PageMonthly active={activePage === 'monthly'} />
        <PageNews    active={activePage === 'news'} onOpenApiKeyModal={() => {}} />
      </div>

      {/* Bottom nav versi demo */}
      <DemoBotNav />

      {/* Shared UI */}
      <ConfirmModal />
      <Toast />
    </>
  );
}