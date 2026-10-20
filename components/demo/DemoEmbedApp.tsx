'use client';
/**
 * components/demo/DemoEmbedApp.tsx
 * Versi stripped-down DemoApp untuk di-embed via <iframe> di landing page.
 *
 * Bedanya dari DemoApp:
 * 1. Tidak ada DemoBanner (fixed top bar info)
 * 2. Tidak ada DemoBotNav (bottom navigation mobile)
 * 3. DemoTopbar tetap ada tapi compact
 * 4. Menerima postMessage { jz_page: string } dari parent (landing page)
 *    untuk switch halaman saat user klik tab di luar iframe
 * 5. Kirim postMessage { jz_ready: true } ke parent saat mount
 * 6. [FIX] Kirim postMessage { jz_active_page: string } ke parent
 *    setiap kali activePage berubah — supaya tab di landing page ikut sync
 */

import { useEffect, useRef } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import PageHome    from '@/components/journal/PageHome';
import PageRisk    from '@/components/journal/PageRisk';
import PagePlan    from '@/components/journal/PagePlan';
import PageData    from '@/components/journal/PageData';
import PageFilter  from '@/components/journal/PageFilter';
import PageWeekly  from '@/components/journal/PageWeekly';
import PageMonthly from '@/components/journal/PageMonthly';
import PageNews    from '@/components/journal/PageNews';
import PageGallery from '@/components/journal/PageGallery';
import DemoTopbar  from './DemoTopbar';
import Toast       from '@/components/journal/Toast';
import ConfirmModal   from '@/components/journal/ConfirmModal';
import TradeBreakdown from '@/components/journal/TradeBreakdown';

export default function DemoEmbedApp() {
  const activePage    = useJournalStore(s => s.activePage);
  const setActivePage = useJournalStore(s => s.setActivePage);

  // Ref untuk track apakah perubahan page berasal dari parent (postMessage)
  // atau dari user yang klik di dalam iframe — supaya tidak loop infinite
  const fromParentRef = useRef(false);

  const switchPage = (page: string) => setActivePage(page as JournalPage);

  // ── Mount: setup theme, auth, default page, listener dari parent ──
  useEffect(() => {
    // Set theme
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });

    // Pastikan tidak ada auth overlay
    useJournalStore.setState({ currentUser: null, authOverlayVisible: false });

    // Default ke tab 'risk' saat embed (bukan lastTab)
    setActivePage('risk');

    // Kirim sinyal ready ke parent
    window.parent?.postMessage({ jz_ready: true }, '*');

    // Terima perintah switch page dari parent (landing page tab button diklik)
    const handler = (e: MessageEvent) => {
      if (e.data?.jz_page && typeof e.data.jz_page === 'string') {
        // Tandai bahwa perubahan ini dari parent agar tidak balik postMessage lagi
        fromParentRef.current = true;
        setActivePage(e.data.jz_page as JournalPage);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── [FIX] Setiap activePage berubah dari dalam iframe → beritahu parent ──
  useEffect(() => {
    if (fromParentRef.current) {
      // Perubahan ini dari parent, reset flag — jangan postMessage balik
      fromParentRef.current = false;
      return;
    }
    // Perubahan dari dalam iframe (user klik navigasi di DemoTopbar, dsb.)
    // → sync ke parent supaya tombol tab di landing page ikut aktif
    window.parent?.postMessage({ jz_active_page: activePage }, '*');
  }, [activePage]);

  return (
    <>
      {/* Topbar compact tanpa banner offset */}
      <div style={{ position: 'sticky', top: 0, zIndex: 300 }}>
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
        <PageGallery active={activePage === 'gallery'} />
      </div>

      <ConfirmModal />
      <TradeBreakdown />
      <Toast />
    </>
  );
}