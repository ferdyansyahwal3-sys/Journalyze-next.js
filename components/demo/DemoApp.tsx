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

export default function DemoApp() {
  const activePage    = useJournalStore(s => s.activePage);
  const setActivePage = useJournalStore(s => s.setActivePage);

  const switchPage = (page: string) => setActivePage(page as JournalPage);

  useEffect(() => {
    // Sama dengan JournalApp — restore theme & last tab
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });

    // Pastikan user selalu null di demo mode
    // → semua store ops tidak akan sync ke Supabase
    useJournalStore.setState({ currentUser: null, authOverlayVisible: false });

    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);
  }, []);

  return (
    <>
      {/* Banner demo — selalu tampil di atas */}
      <DemoBanner />

      {/* Topbar versi demo — tanpa user menu, tanpa logout */}
      <DemoTopbar />

      {/* Main content — 100% sama dengan JournalApp */}
      <div className={`main ${activePage === 'home' ? 'home-active' : ''}`}>
        {/*
          Semua Page dipass userId=null secara implisit melalui store.
          useJournalStore.currentUser = null → semua operasi write
          di useTradeStore tidak akan menyentuh Supabase.
        */}
        <PageHome
          active={activePage === 'home'}
          switchPage={switchPage}
          openApiKeyModal={() => {}}
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