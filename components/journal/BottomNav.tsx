// components/journal/BottomNav.tsx
'use client';

import React from 'react';
import {
  House, Scales, CalendarBlank, ClipboardText, Funnel,
  CalendarDots, ChartBar, Bell, BellSlash, Key,
  Moon, Sun, User, SignOut, DotsThree
} from '@phosphor-icons/react';
import { useJournalStore, BN_MAIN, BN_MORE, JournalPage } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const MAIN_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  home:   { icon: <House size={22} />,         label: 'Home' },
  risk:   { icon: <Scales size={22} />,        label: 'Risiko' },
  plan:   { icon: <CalendarBlank size={22} />, label: 'Plan' },
  data:   { icon: <ClipboardText size={22} />, label: 'Jurnal' },
  filter: { icon: <Funnel size={22} />,        label: 'Filter' },
};

const MORE_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  weekly:  { icon: <CalendarDots size={22} />, label: 'Mingguan' },
  monthly: { icon: <ChartBar size={22} />,     label: 'Bulanan' },
  news:    { icon: <Bell size={22} />,         label: 'News Forex' },
};

interface BottomNavProps {
  apiKeyActive?: boolean;
  notifGranted?: boolean;
  onOpenApiKey?: () => void;
  onOpenNotif?: () => void;
}

export default function BottomNav({
  apiKeyActive = false,
  notifGranted = false,
  onOpenApiKey,
  onOpenNotif,
}: BottomNavProps) {
  const activePage       = useJournalStore((s) => s.activePage);
  const setActivePage    = useJournalStore((s) => s.setActivePage);
  const moreDrawerOpen   = useJournalStore((s) => s.moreDrawerOpen);
  const toggleMoreDrawer = useJournalStore((s) => s.toggleMoreDrawer);
  const closeMoreDrawer  = useJournalStore((s) => s.closeMoreDrawer);
  const theme            = useJournalStore((s) => s.theme);
  const setTheme         = useJournalStore((s) => s.setTheme);
  const currentUser      = useJournalStore((s) => s.currentUser);
  const { doLogout }     = useJournalAuth();

  const bnNav = (id: JournalPage) => { closeMoreDrawer(); setActivePage(id); };
  const handleOpenApiKey  = () => { closeMoreDrawer(); onOpenApiKey?.(); };
  const handleOpenNotif   = () => { closeMoreDrawer(); onOpenNotif?.(); };
  const handleOpenProfile = () => { closeMoreDrawer(); setActivePage('profile'); };

  const email = currentUser?.email || '';

  return (
    <>
      {/* Overlay gelap di belakang drawer */}
      <div
        className={`bn-overlay ${moreDrawerOpen ? 'show' : ''}`}
        onClick={closeMoreDrawer}
      />

      {/*
        bn-more-drawer — drawer "Menu Lainnya"
        Padding bawah ditangani lewat CSS di layout.tsx (@media standalone).
        Style inline di sini hanya untuk konten di dalam drawer.
      */}
      <div className={`bn-more-drawer ${moreDrawerOpen ? 'open' : ''}`}>
        <div className="bn-drawer-handle" />
        <div className="bn-drawer-title">Menu Lainnya</div>

        <div className="bn-drawer-grid">
          {(Object.keys(MORE_ICONS) as JournalPage[]).map((p) => (
            <button
              key={p}
              className={`bn-drawer-item ${activePage === p ? 'active' : ''}`}
              onClick={() => bnNav(p)}
            >
              <span className="bn-drawer-icon">{MORE_ICONS[p].icon}</span>
              {MORE_ICONS[p].label}
            </button>
          ))}
        </div>

        {/* Tema */}
        <div className="bn-drawer-theme">
          <span className="bn-drawer-theme-label">Tema Tampilan</span>
          <div className="bn-theme-pill">
            <button
              className={`bn-topt ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={13} /> Dark
            </button>
            <button
              className={`bn-topt ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={13} /> Light
            </button>
          </div>
        </div>

        {/* API Key */}
        <div
          className="bn-drawer-theme"
          style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}
        >
          <span className="bn-drawer-theme-label">API Key (AI Analisis Foto)</span>
          <button
            className={`btn-apikey ${apiKeyActive ? 'key-active' : 'key-warn'}`}
            title="Hubungkan API Key untuk fitur analisis foto"
            onClick={handleOpenApiKey}
          >
            <Key size={13} />
            <span>API Key</span>
          </button>
        </div>

        {/* Notifikasi */}
        <div
          className="bn-drawer-theme"
          style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}
        >
          <span className="bn-drawer-theme-label">Notifikasi &amp; Pengingat</span>
          <button
            className={`btn-notif ${notifGranted ? 'notif-on' : ''}`}
            title="Pengaturan Notifikasi"
            onClick={handleOpenNotif}
          >
            {notifGranted ? <Bell size={13} /> : <BellSlash size={13} />}
            <span>Notif</span>
          </button>
        </div>

        {/* Profil */}
        <div
          className="bn-drawer-theme"
          style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}
        >
          <span className="bn-drawer-theme-label">Akun</span>
          <button
            className="bn-drawer-item"
            style={{ justifyContent: 'center' }}
            onClick={handleOpenProfile}
          >
            <User size={16} /> Profil Saya
          </button>
        </div>

        {/* Footer drawer — email + logout */}
        <div
          style={{
            margin: '14px 0 0',
            padding: '14px 0 0',
            borderTop: '1px solid var(--gold-bd)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {(email[0] || '?').toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '.3px',
                }}
              >
                {email}
              </span>
            </div>

            <button
              onClick={() => { closeMoreDrawer(); doLogout(); }}
              style={{
                background: 'rgba(232,64,64,0.08)',
                border: '1px solid rgba(232,64,64,0.2)',
                color: '#E84040',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <SignOut size={13} />
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/*
        bot-nav — bottom navigation bar utama
        Padding bawah ditangani lewat CSS di layout.tsx (@media standalone)
        supaya tombol tidak ketutup home indicator iPhone.
      */}
      <nav className="bot-nav">
        {BN_MAIN.map((p) => (
          <button
            key={p}
            className={`bn-btn ${activePage === p ? 'active' : ''}`}
            onClick={() => bnNav(p)}
          >
            <div className="bn-icon-wrap">
              <span className="bn-icon">{MAIN_ICONS[p].icon}</span>
            </div>
            <span className="bn-label">{MAIN_ICONS[p].label}</span>
          </button>
        ))}

        {/* Tombol "Lainnya" untuk buka drawer */}
        <button
          className={`bn-btn ${BN_MORE.includes(activePage) ? 'active' : ''}`}
          onClick={toggleMoreDrawer}
        >
          <div className="bn-icon-wrap">
            <span className="bn-icon"><DotsThree size={22} weight="bold" /></span>
          </div>
          <span className="bn-label">Lainnya</span>
        </button>
      </nav>
    </>
  );
}