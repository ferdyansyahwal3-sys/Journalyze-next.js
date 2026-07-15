// components/journal/Topbar.tsx
// Dipindah dari index.html baris 1574-1618. Tombol Notif & API Key
// disiapkan tempatnya tapi belum fungsional (modalnya baru dibangun
// di Phase 6-7 sesuai roadmap) — ditandai TODO, bukan dihilangkan,
// supaya tampilan topbar tetap identik.
'use client';

import { useJournalStore, JournalPage } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const PAGE_TABS: { id: JournalPage; label: string }[] = [
  { id: 'home', label: '🏠 Home' },
  { id: 'risk', label: '⚖️ Risiko' },
  { id: 'plan', label: '📅 Plan' },
  { id: 'data', label: '📋 Jurnal' },
  { id: 'filter', label: '🔍 Filter' },
  { id: 'weekly', label: '📆 Mingguan' },
  { id: 'monthly', label: '📊 Bulanan' },
  { id: 'news', label: '📰 News' },
];

export default function Topbar() {
  const activePage = useJournalStore((s) => s.activePage);
  const setActivePage = useJournalStore((s) => s.setActivePage);
  const theme = useJournalStore((s) => s.theme);
  const setTheme = useJournalStore((s) => s.setTheme);
  const currentUser = useJournalStore((s) => s.currentUser);
  const userMenuOpen = useJournalStore((s) => s.userMenuOpen);
  const toggleUserMenu = useJournalStore((s) => s.toggleUserMenu);
  const { doLogout } = useJournalAuth();

  const email = currentUser?.email || '';

  return (
    <nav className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div className="brand-logo">
          Journal<em>yze</em>
        </div>
        <div className="brand-tag">Suite</div>
      </div>

      <div className="page-tabs">
        {PAGE_TABS.map((t) => (
          <button
            key={t.id}
            className={`ptab ${activePage === t.id ? 'active' : ''}`}
            onClick={() => setActivePage(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="theme-pill">
        <button className={`topt ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
          🌙 Dark
        </button>
        <button className={`topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
          ☀️ Light
        </button>
      </div>

      {/* TODO Phase 7: openNotifModal() */}
      <button className="btn-notif" title="Pengaturan Notifikasi">
        <span>🔔</span>
        <span>Notif</span>
      </button>

      {/* TODO Phase 6: openApiKeyModal() (fitur AI foto analisa) */}
      <button className="btn-apikey key-warn" title="Hubungkan API Key untuk fitur analisis foto">
        <span className="key-dot"></span>
        <span>API Key</span>
      </button>

      <div className="user-badge" style={{ display: currentUser ? 'flex' : 'none' }} onClick={toggleUserMenu}>
        <div className="user-avatar">{(email[0] || '?').toUpperCase()}</div>
        <span className="user-email-lbl">{email}</span>
      </div>

      <div className={`user-menu ${userMenuOpen ? 'open' : ''}`}>
        <div className="sync-indicator" style={{ padding: '6px 12px 10px' }}>
          <div className="sync-dot"></div>
          <span>Tersinkron</span>
          {/* TODO Phase 4: dbgLog debug panel, dipindah bareng cloud sync engine (loadCloudData) */}
          <button
            title="Debug Supabase Log"
            style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 10, padding: '0 2px', opacity: 0.5, lineHeight: 1 }}
          >
            🔍
          </button>
        </div>
        <div className="user-menu-item danger" onClick={doLogout}>
          🚪 Keluar
        </div>
      </div>
    </nav>
  );
}