// components/journal/JournalApp.tsx
'use client';

import { useEffect } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import Splash from './Splash';
import AuthOverlay from './AuthOverlay';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PagePlaceholder from './PagePlaceholder';
import PageHome from './PageHome';
import PageRisk from './PageRisk';
import PagePlan from './PagePlan';
import PageData from './PageData';
import PageFilter from './PageFilter';

const PLACEHOLDER_PAGES: { id: JournalPage; title: string }[] = [
  { id: 'news',    title: 'News' },
  { id: 'weekly',  title: 'Mingguan' },
  { id: 'monthly', title: 'Bulanan' },
];

export default function JournalApp() {
  const activePage    = useJournalStore((s) => s.activePage);
  const setActivePage = useJournalStore((s) => s.setActivePage);

  const switchPage = (page: string) => setActivePage(page as JournalPage);

  useEffect(() => {
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });

    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);
  }, []);

  return (
    <>
      <AuthOverlay />
      <Splash />
      <Topbar />

      <div className={`main ${activePage === 'home' ? 'home-active' : ''}`}>
        <PageHome active={activePage === 'home'} switchPage={switchPage} openApiKeyModal={() => {}} />
        <PageRisk active={activePage === 'risk'} />
        <PagePlan active={activePage === 'plan'} switchPage={switchPage} />
        <PageData active={activePage === 'data'} />
        <PageFilter active={activePage === 'filter'} />

        {PLACEHOLDER_PAGES.map((p) => (
          <PagePlaceholder key={p.id} id={p.id} title={p.title} active={activePage === p.id} />
        ))}
      </div>

      <BottomNav />
      <ConfirmModal />
      <Toast />
    </>
  );
}