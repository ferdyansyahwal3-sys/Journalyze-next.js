// components/journal/Topbar.tsx
'use client';

import { useJournalStore, JournalPage } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const PAGE_TABS: { id: JournalPage; label: string }[] = [
  { id: 'home',    label: '🏠 Home' },
  { id: 'risk',    label: '⚖️ Risiko' },
  { id: 'plan',    label: '📅 Plan' },
  { id: 'data',    label: '📋 Jurnal' },
  { id: 'filter',  label: '🔍 Filter' },
  { id: 'weekly',  label: '📆 Mingguan' },
  { id: 'monthly', label: '📊 Bulanan' },
  { id: 'news',    label: '📰 News' },
];

// ── Phase 13: props baru untuk tombol NOTIF & API KEY ──
interface TopbarProps {
  apiKeyActive?: boolean;
  notifGranted?: boolean;
  onOpenApiKey?: () => void;
  onOpenNotif?:  () => void;
}

export default function Topbar({
  apiKeyActive = false,
  notifGranted = false,
  onOpenApiKey = () => {},
  onOpenNotif  = () => {},
}: TopbarProps) {
  const activePage     = useJournalStore((s) => s.activePage);
  const setActivePage  = useJournalStore((s) => s.setActivePage);
  const theme          = useJournalStore((s) => s.theme);
  const setTheme       = useJournalStore((s) => s.setTheme);
  const currentUser    = useJournalStore((s) => s.currentUser);
  const userMenuOpen   = useJournalStore((s) => s.userMenuOpen);
  const toggleUserMenu = useJournalStore((s) => s.toggleUserMenu);
  const { doLogout }   = useJournalAuth();

  const email       = currentUser?.email || '';
  const displayName = useJournalStore((s) => s.displayName);
  // Tampilkan: nama dari profiles → fallback username email
  const nameLabel   = displayName || email.split('@')[0] || '';
  const avatarChar  = (displayName[0] || email[0] || '?').toUpperCase();

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
        <button className={`topt ${theme === 'dark'  ? 'active' : ''}`} onClick={() => setTheme('dark')}>
          🌙 Dark
        </button>
        <button className={`topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
          ☀️ Light
        </button>
      </div>

      {/* Phase 13: NOTIF button — fungsional */}
      <button
        className={`btn-notif${notifGranted ? ' notif-on' : ''}`}
        id="btn-notif"
        onClick={onOpenNotif}
        title="Pengaturan Notifikasi"
      >
        <span>{notifGranted ? '🔔' : '🔕'}</span>
        <span>{notifGranted ? 'Notif ON' : 'Notif'}</span>
      </button>

      {/* Phase 13: API KEY button — fungsional */}
      <button
        className={`btn-apikey${apiKeyActive ? ' key-active' : ' key-warn'}`}
        id="btn-apikey"
        onClick={onOpenApiKey}
        title="Hubungkan API Key untuk fitur analisis foto"
      >
        <span className="key-dot"></span>
        <span id="apikey-btn-label">{apiKeyActive ? 'AI Aktif' : 'API Key'}</span>
      </button>

      <div
        className="user-badge"
        style={{ display: currentUser ? 'flex' : 'none' }}
        onClick={toggleUserMenu}
      >
        <div className="user-avatar">{avatarChar}</div>
        <span className="user-email-lbl">{nameLabel}</span>
      </div>

      <div className={`user-menu ${userMenuOpen ? 'open' : ''}`}>
        <div className="sync-indicator" style={{ padding: '6px 12px 10px' }}>
          <div className="sync-dot"></div>
          <span>Tersinkron</span>
          <button
            title="Debug Supabase Log"
            style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 10, padding: '0 2px', opacity: 0.5, lineHeight: 1 }}
          >
            🔍
          </button>
        </div>
        <div className="user-menu-item" onClick={() => { toggleUserMenu(); setActivePage('profile'); }}>
          👤 Profil Saya
        </div>
        <div className="user-menu-item danger" onClick={doLogout}>
          🚪 Keluar
        </div>
      </div>
    </nav>
  );
}