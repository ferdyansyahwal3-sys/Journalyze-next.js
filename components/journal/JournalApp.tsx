// components/journal/JournalApp.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import { useTradeStore } from '@/store/useTradeStore';
import { usePlan } from '@/hooks/usePlan';
import { FAKE_TRADES } from '@/lib/fakeTradeData';
import Splash from './Splash';
import AuthOverlay from './AuthOverlay';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PageHome from './PageHome';
import dynamic from 'next/dynamic';
const PageRisk = dynamic(() => import('./PageRisk'), { ssr: false });
import PagePlan from './PagePlan';
import PageData from './PageData';
import PageFilter from './PageFilter';
import PageWeekly from './PageWeekly';
import PageMonthly from './PageMonthly';
import PageNews from './PageNews';
import ApiKeyModal from './ApiKeyModal';
import NotifModal from './NotifModal';
import PageProfile from './PageProfile';
import DemoBanner from './DemoBanner';
import PlanLockOverlay from './PlanLockOverlay';
import PaymentSuccessModal from './PaymentSuccessModal';

function readApiKeyActive(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    localStorage.getItem('jz_gemini_key') ||
    localStorage.getItem('jz_anthropic_key')
  );
}
function readNotifGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export default function JournalApp() {
  const activePage    = useJournalStore((s) => s.activePage);
  const setActivePage = useJournalStore((s) => s.setActivePage);
  const showToast     = useJournalStore((s) => s.showToast);
  const currentUser   = useJournalStore((s) => s.currentUser);
  const switchPage = (page: string) => setActivePage(page as JournalPage);

  const { isFree, canFilter, canMonthly, canAI, canPhotoMT5 } = usePlan();

  const [apiKeyOpen,    setApiKeyOpen]    = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [apiKeyActive,  setApiKeyActive]  = useState(false);
  const [notifGranted,  setNotifGranted]  = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);

  // Inject fake trades saat user free login
  useEffect(() => {
    if (currentUser && isFree) {
      useTradeStore.setState({ trades: FAKE_TRADES, loaded: true });
      // Tampilkan popup demo saat pertama kali login sebagai free user
      const shownKey = `jz_demo_popup_shown_${currentUser.id}`;
      if (!sessionStorage.getItem(shownKey)) {
        setShowDemoPopup(true);
        sessionStorage.setItem(shownKey, '1');
      }
    }
  }, [currentUser, isFree]);

  useEffect(() => {
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });
    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);

    setApiKeyActive(readApiKeyActive());
    setNotifGranted(readNotifGranted());

    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam) setActivePage(pageParam as JournalPage);
  }, []);

  const handleApiKeySaved = useCallback((hasKey: boolean) => {
    setApiKeyActive(hasKey);
  }, []);

  const handleNotifClose = useCallback(() => {
    setNotifOpen(false);
    setNotifGranted(readNotifGranted());
  }, []);

  const handleToast = useCallback((msg: string, type: 'success' | 'error') => {
    showToast(msg, type);
  }, [showToast]);

  // Ambil email user untuk pre-fill di halaman order
  const userEmail = currentUser?.email || '';

  return (
    <>
      <AuthOverlay />
      <Splash />

      {/* Banner demo mode */}
      {currentUser && isFree && <DemoBanner />}

      {/* Popup demo saat pertama login */}
      {showDemoPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#111', border: '1px solid #C9A84C44',
            borderRadius: 20, padding: '36px 28px',
            maxWidth: 400, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👀</div>
            <h2 style={{ color: '#C9A84C', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Kamu sedang di Mode Demo
            </h2>
            <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7, margin: '0 0 20px' }}>
              Data trading yang kamu lihat adalah <strong style={{ color: '#fff' }}>data palsu</strong> untuk
              keperluan demo saja. Data ini <strong style={{ color: '#e74c3c' }}>tidak tersimpan</strong> dan
              akan hilang saat kamu logout atau refresh.
            </p>
            <div style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 12, color: '#666', lineHeight: 1.6,
            }}>
              💡 Upgrade ke Premium untuk mulai mencatat trade sungguhan dan semua data tersimpan aman di cloud.
            </div>
            <button
              onClick={() => {
                setShowDemoPopup(false);
                window.location.href = `/upgrade?email=${encodeURIComponent(userEmail)}`;
              }}
              style={{
                width: '100%', background: '#C9A84C', color: '#000',
                border: 'none', borderRadius: 10, padding: '13px',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10,
              }}
            >
              💳 Upgrade Sekarang
            </button>
            <button
              onClick={() => setShowDemoPopup(false)}
              style={{
                background: 'transparent', color: '#555',
                border: 'none', cursor: 'pointer', fontSize: 13,
              }}
            >
              Lihat Demo Dulu
            </button>
          </div>
        </div>
      )}

      {/* Popup setelah bayar */}
      <PaymentSuccessModal />

      <Topbar
        apiKeyActive={apiKeyActive}
        notifGranted={notifGranted}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenNotif={() => setNotifOpen(true)}
      />

      <div
        className={`main ${activePage === 'home' ? 'home-active' : ''}`}
        style={{ paddingTop: currentUser && isFree ? 44 : undefined }}
      >
        <PageHome active={activePage === 'home'} switchPage={switchPage} openApiKeyModal={() => setApiKeyOpen(true)} />
        <PageRisk active={activePage === 'risk'} />
        <PagePlan active={activePage === 'plan'} switchPage={switchPage} />
        <PageData active={activePage === 'data'} />

        {/* PageFilter — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageFilter active={activePage === 'filter'} />
          {activePage === 'filter' && !canFilter && currentUser && (
            <PlanLockOverlay feature="Filter Trading" userEmail={userEmail} />
          )}
        </div>

        {/* PageWeekly — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageWeekly active={activePage === 'weekly'} />
          {activePage === 'weekly' && !canFilter && currentUser && (
            <PlanLockOverlay feature="Analisis Mingguan" userEmail={userEmail} />
          )}
        </div>

        {/* PageMonthly — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageMonthly active={activePage === 'monthly'} />
          {activePage === 'monthly' && !canMonthly && currentUser && (
            <PlanLockOverlay feature="Analisis Bulanan" userEmail={userEmail} />
          )}
        </div>

        {/* PageNews (AI) — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageNews active={activePage === 'news'} onOpenApiKeyModal={() => setApiKeyOpen(true)} />
          {activePage === 'news' && !canAI && currentUser && (
            <PlanLockOverlay feature="Analisis AI & Berita" userEmail={userEmail} />
          )}
        </div>

        <PageProfile active={activePage === 'profile'} onOpenApiKey={() => setApiKeyOpen(true)} onOpenNotif={() => setNotifOpen(true)} />
      </div>

      <BottomNav
        apiKeyActive={apiKeyActive}
        notifGranted={notifGranted}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenNotif={() => setNotifOpen(true)}
      />
      <ConfirmModal />
      <Toast />

      {/* ApiKeyModal — dikunci untuk free & basic */}
      {canPhotoMT5 ? (
        <ApiKeyModal
          isOpen={apiKeyOpen}
          onClose={() => setApiKeyOpen(false)}
          onSaved={handleApiKeySaved}
          onToast={handleToast}
        />
      ) : (
        apiKeyOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 150,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setApiKeyOpen(false)}
          >
            <div
              style={{
                background: '#111', border: '1px solid #333',
                borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <div style={{ color: '#C9A84C', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Fitur Pro & Elite
              </div>
              <div style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Analisis foto MT5 dan AI hanya tersedia untuk Paket Pro & Elite.
              </div>
              <button
                onClick={() => {
                  setApiKeyOpen(false);
                  window.location.href = `/upgrade?email=${encodeURIComponent(userEmail)}`;
                }}
                style={{
                  background: '#C9A84C', color: '#000', border: 'none',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 8,
                }}
              >
                Upgrade Sekarang →
              </button>
              <button
                onClick={() => setApiKeyOpen(false)}
                style={{
                  background: 'transparent', color: '#555',
                  border: 'none', cursor: 'pointer', fontSize: 13,
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        )
      )}

      <NotifModal
        isOpen={notifOpen}
        onClose={handleNotifClose}
        onToast={handleToast}
      />
    </>
  );
}
