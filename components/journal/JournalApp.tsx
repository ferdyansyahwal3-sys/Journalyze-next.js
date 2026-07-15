// components/journal/JournalApp.tsx
// Pengganti kerangka index.html: <div class="main [home-active]"> yang
// membungkus 8 <div class="page">, plus splash/auth overlay/topbar/botnav.
'use client';

import { useEffect } from 'react';
import { useJournalStore, JournalPage } from '@/store/useJournalStore';
import Splash from './Splash';
import AuthOverlay from './AuthOverlay';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PagePlaceholder from './PagePlaceholder';

const PAGES: { id: JournalPage; title: string }[] = [
  { id: 'home', title: 'Home' },
  { id: 'news', title: 'News' },
  { id: 'risk', title: 'Risiko' },
  { id: 'plan', title: 'Plan' },
  { id: 'data', title: 'Jurnal' },
  { id: 'filter', title: 'Filter' },
  { id: 'weekly', title: 'Mingguan' },
  { id: 'monthly', title: 'Bulanan' },
];

export default function JournalApp() {
  const activePage = useJournalStore((s) => s.activePage);

  // index.html baris 3340-3343 — load theme tersimpan saat mount
  useEffect(() => {
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });
    // index.html tidak restore last_tab otomatis di switchPage, tapi
    // jz_last_tab disimpan tiap ganti tab — tidak di-restore saat load
    // di source aslinya, jadi di sini pun sengaja tidak di-restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AuthOverlay />
      <Splash />
      <Topbar />

      <div className={`main ${activePage === 'home' ? 'home-active' : ''}`}>
        {PAGES.map((p) => (
          <PagePlaceholder key={p.id} id={p.id} title={p.title} active={activePage === p.id} />
        ))}
      </div>

      <BottomNav />
      <ConfirmModal />
      <Toast />
    </>
  );
}