// components/journal/JournalApp.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import Splash from './Splash';
import AuthOverlay from './AuthOverlay';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PageHome from './PageHome';
import PageRisk from './PageRisk';
import PagePlan from './PagePlan';
import PageData from './PageData';
import PageFilter from './PageFilter';
import PageWeekly from './PageWeekly';
import PageMonthly from './PageMonthly';
import PageNews from './PageNews';
import ApiKeyModal from './ApiKeyModal';
import NotifModal from './NotifModal';

// ── Phase 13 helpers ──
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
  const switchPage = (page: string) => setActivePage(page as JournalPage);

  // ── Phase 13 state ──
  const [apiKeyOpen,   setApiKeyOpen]   = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [apiKeyActive, setApiKeyActive] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    // Restore theme & last tab (existing logic)
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });
    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);

    // Phase 13: hydrate button states
    setApiKeyActive(readApiKeyActive());
    setNotifGranted(readNotifGranted());
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

  return (
    <>
      <AuthOverlay />
      <Splash />
      <Topbar
        apiKeyActive={apiKeyActive}
        notifGranted={notifGranted}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenNotif={() => setNotifOpen(true)}
      />
      <div className={`main ${activePage === 'home' ? 'home-active' : ''}`}>
        <PageHome active={activePage === 'home'} switchPage={switchPage} openApiKeyModal={() => setApiKeyOpen(true)} />
        <PageRisk active={activePage === 'risk'} />
        <PagePlan active={activePage === 'plan'} switchPage={switchPage} />
        <PageData active={activePage === 'data'} />
        <PageFilter active={activePage === 'filter'} />
        <PageWeekly active={activePage === 'weekly'} />
        <PageMonthly active={activePage === 'monthly'} />
        <PageNews active={activePage === 'news'} />
      </div>
      <BottomNav />
      <ConfirmModal />
      <Toast />

      {/* ── Phase 13 Modals ── */}
      <ApiKeyModal
        isOpen={apiKeyOpen}
        onClose={() => setApiKeyOpen(false)}
        onSaved={handleApiKeySaved}
        onToast={handleToast}
      />
      <NotifModal
        isOpen={notifOpen}
        onClose={handleNotifClose}
        onToast={handleToast}
      />
    </>
  );
}