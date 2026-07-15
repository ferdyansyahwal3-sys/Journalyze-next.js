// components/journal/BottomNav.tsx
// Dipindah dari index.html baris 3208-3292 (markup) + bnNav/updateBotNav/
// toggleMoreDrawer/closeMoreDrawer (baris 4995-5058). Di React, active
// state cukup derived dari `activePage` — tidak perlu imperative
// classList.toggle per tombol seperti aslinya.
'use client';

import { useJournalStore, BN_MAIN, BN_MORE, JournalPage } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const MAIN_ICONS: Record<string, { icon: string; label: string }> = {
  home: { icon: '🏠', label: 'Home' },
  risk: { icon: '⚖️', label: 'Risiko' },
  plan: { icon: '📅', label: 'Plan' },
  data: { icon: '📋', label: 'Jurnal' },
  filter: { icon: '🔍', label: 'Filter' },
};

const MORE_ICONS: Record<string, { icon: string; label: string }> = {
  weekly: { icon: '📆', label: 'Mingguan' },
  monthly: { icon: '📊', label: 'Bulanan' },
  news: { icon: '📰', label: 'News Forex' },
};

export default function BottomNav() {
  const activePage = useJournalStore((s) => s.activePage);
  const setActivePage = useJournalStore((s) => s.setActivePage);
  const moreDrawerOpen = useJournalStore((s) => s.moreDrawerOpen);
  const toggleMoreDrawer = useJournalStore((s) => s.toggleMoreDrawer);
  const closeMoreDrawer = useJournalStore((s) => s.closeMoreDrawer);
  const theme = useJournalStore((s) => s.theme);
  const setTheme = useJournalStore((s) => s.setTheme);
  const currentUser = useJournalStore((s) => s.currentUser);
  const { doLogout } = useJournalAuth();

  const bnNav = (id: JournalPage) => {
    closeMoreDrawer();
    setActivePage(id);
  };

  const email = currentUser?.email || '';

  return (
    <>
      {/* Overlay gelap saat drawer terbuka — index.html baris 3213 */}
      <div className={`bn-overlay ${moreDrawerOpen ? 'show' : ''}`} onClick={closeMoreDrawer}></div>

      {/* More drawer — index.html baris 3216-3264 */}
      <div className={`bn-more-drawer ${moreDrawerOpen ? 'open' : ''}`}>
        <div className="bn-drawer-handle"></div>
        <div className="bn-drawer-title">Menu Lainnya</div>
        <div className="bn-drawer-grid">
          {(Object.keys(MORE_ICONS) as JournalPage[]).map((p) => (
            <button key={p} className={`bn-drawer-item ${activePage === p ? 'active' : ''}`} onClick={() => bnNav(p)}>
              <span className="bn-drawer-icon">{MORE_ICONS[p].icon}</span> {MORE_ICONS[p].label}
            </button>
          ))}
        </div>
        <div className="bn-drawer-theme">
          <span className="bn-drawer-theme-label">Tema Tampilan</span>
          <div className="bn-theme-pill">
            <button className={`bn-topt ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
              🌙 Dark
            </button>
            <button className={`bn-topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
              ☀️ Light
            </button>
          </div>
        </div>
        <div className="bn-drawer-theme" style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span className="bn-drawer-theme-label">API Key (AI Analisis Foto)</span>
          {/* TODO Phase 6: openApiKeyModal() */}
          <button className="btn-apikey key-warn" title="Hubungkan API Key untuk fitur analisis foto" onClick={toggleMoreDrawer}>
            <div className="key-dot"></div>
            <span>API Key</span>
          </button>
        </div>
        <div className="bn-drawer-theme" style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span className="bn-drawer-theme-label">Notifikasi &amp; Pengingat</span>
          {/* TODO Phase 7: openNotifModal() */}
          <button className="btn-notif" title="Pengaturan Notifikasi" onClick={toggleMoreDrawer}>
            <span>🔔</span>
            <span>Notif</span>
          </button>
        </div>
        <div style={{ margin: '14px 0 0', padding: '14px 0 0', borderTop: '1px solid var(--gold-bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {(email[0] || '?').toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.3px' }}>
                {email}
              </span>
            </div>
            <button
              onClick={() => {
                closeMoreDrawer();
                doLogout();
              }}
              style={{
                background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.2)', color: '#E84040',
                borderRadius: 8, padding: '7px 14px', fontSize: 12, fontFamily: "'Outfit',sans-serif", fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav bar — index.html baris 3267-3292 */}
      <nav className="bot-nav">
        {BN_MAIN.map((p) => (
          <button key={p} className={`bn-btn ${activePage === p ? 'active' : ''}`} onClick={() => bnNav(p)}>
            <div className="bn-icon-wrap">
              <span className="bn-icon">{MAIN_ICONS[p].icon}</span>
            </div>
            <span className="bn-label">{MAIN_ICONS[p].label}</span>
          </button>
        ))}
        <button className={`bn-btn ${BN_MORE.includes(activePage) ? 'active' : ''}`} onClick={toggleMoreDrawer}>
          <div className="bn-icon-wrap">
            <span className="bn-icon">⋯</span>
          </div>
          <span className="bn-label">Lainnya</span>
        </button>
      </nav>
    </>
  );
}