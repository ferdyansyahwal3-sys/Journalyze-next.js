'use client';

import { useState, useEffect, useCallback } from 'react';

const NOTIF_PREFS_KEY = 'jz_notif_prefs';
const LS_NICKNAME     = 'jz_notif_nickname';

export interface NotifPrefs {
  news:     boolean;
  reminder: boolean;
  time:     string;
}

function getNotifPrefs(): NotifPrefs {
  try {
    if (typeof window === 'undefined') return { news: true, reminder: true, time: '21:00' };
    const p = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}');
    return {
      news:     p.news     !== false,
      reminder: p.reminder !== false,
      time:     p.time     || '21:00',
    };
  } catch { return { news: true, reminder: true, time: '21:00' }; }
}

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function useNotifications() {
  const [permission,   setPermission]  = useState<NotifPermission>('unsupported');
  const [prefs,        setPrefs]       = useState<NotifPrefs>(getNotifPrefs());
  const [nickname,     setNickname]    = useState('');
  const [statusHtml,   setStatusHtml]  = useState('Memuat status notifikasi...');

  // Refresh permission state
  const refreshPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotifPermission);
  }, []);

  useEffect(() => {
    refreshPermission();
    setNickname(localStorage.getItem(LS_NICKNAME) || '');
    setPrefs(getNotifPrefs());
  }, [refreshPermission]);

  // Update status message based on current permission
  useEffect(() => {
    if (permission === 'unsupported') {
      setStatusHtml('❌ Browser kamu tidak mendukung notifikasi. Coba buka di Chrome atau Safari iOS 16.4+.');
      return;
    }
    if (permission === 'granted') {
      setStatusHtml('✅ Notifikasi <strong>aktif</strong>. Journalyze siap mengirim alert berita high-impact dan pengingat jurnal ke HP kamu.');
    } else if (permission === 'denied') {
      setStatusHtml('🚫 Notifikasi <strong>diblokir</strong>. Klik ikon <strong>🔒</strong> di address bar → Izin Situs → Notifikasi → <strong>Izinkan</strong>, lalu refresh.');
    } else {
      setStatusHtml('🔔 Notifikasi <strong>belum diaktifkan</strong>. Klik tombol di bawah untuk mengaktifkan.');
    }
  }, [permission]);

  // Request permission — must be called from a direct user gesture
  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    let perm: NotificationPermission;
    const result = Notification.requestPermission();
    if (result && typeof (result as Promise<NotificationPermission>).then === 'function') {
      perm = await (result as Promise<NotificationPermission>);
    } else {
      // Legacy callback API — cast
      perm = result as unknown as NotificationPermission;
    }
    setPermission(perm as NotifPermission);
    return perm as NotifPermission;
  }, []);

  const savePrefs = useCallback((newPrefs: NotifPrefs) => {
    setPrefs(newPrefs);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(newPrefs));
    }
  }, []);

  const saveNickname = useCallback((name: string) => {
    setNickname(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_NICKNAME, name);
    }
  }, []);

  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') return;
    const name  = nickname || 'Trader';
    const title = `🧪 Halo ${name}! Test Journalyze`;
    const body  = 'Notifikasi berhasil aktif! Kamu akan menerima alert berita & pengingat jurnal. ✅';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, {
          body, tag: 'jz-test',
          icon: '/icon-192.png', badge: '/icon-192.png',
          requireInteraction: false,
        } as NotificationOptions))
        .catch(() => { try { new Notification(title, { body, icon: '/icon-192.png' }); } catch {} });
    } else {
      try { new Notification(title, { body, icon: '/icon-192.png' }); } catch {}
    }
  }, [permission, nickname]);

  return {
    permission,
    prefs,
    nickname,
    statusHtml,
    refreshPermission,
    requestPermission,
    savePrefs,
    saveNickname,
    sendTestNotification,
  };
}