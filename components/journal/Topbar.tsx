// components/journal/Topbar.tsx
'use client';

import React from 'react';
import {
  House, Scales, CalendarBlank, ClipboardText, Funnel,
  CalendarDots, ChartBar, Bell, BellSlash, Moon, Sun
} from '@phosphor-icons/react';
import { useJournalStore, JournalPage } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const PAGE_TABS: { id: JournalPage; label: string; icon: React.ReactNode }[] = [
  { id: 'home',    label: 'Home',     icon: <House size={13} /> },
  { id: 'risk',    label: 'Risiko',   icon: <Scales size={13} /> },
  { id: 'plan',    label: 'Plan',     icon: <CalendarBlank size={13} /> },
  { id: 'data',    label: 'Jurnal',   icon: <ClipboardText size={13} /> },
  { id: 'filter',  label: 'Filter',   icon: <Funnel size={13} /> },
  { id: 'weekly',  label: 'Mingguan', icon: <CalendarDots size={13} /> },
  { id: 'monthly', label: 'Bulanan',  icon: <ChartBar size={13} /> },
  { id: 'news',    label: 'News',     icon: <Bell size={13} /> },
];

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
            <span className="ptab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="theme-pill">
        <button className={`topt ${theme === 'dark'  ? 'active' : ''}`} onClick={() => setTheme('dark')}>
          <Moon size={12} /> Dark
        </button>
        <button className={`topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
          <Sun size={12} /> Light
        </button>
      </div>

      <button
        className={`btn-notif${notifGranted ? ' notif-on' : ''}`}
        id="btn-notif"
        onClick={onOpenNotif}
        title="Pengaturan Notifikasi"
      >
        {notifGranted ? <Bell size={13} /> : <BellSlash size={13} />}
        <span>{notifGranted ? 'Notif ON' : 'Notif'}</span>
      </button>

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
