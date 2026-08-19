'use client';

import { useEffect, useRef } from 'react';
import { useNotifications, NotifPrefs } from '@/hooks/useNotifications';

interface NotifModalProps {
  isOpen:  boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function NotifModal({ isOpen, onClose, onToast }: NotifModalProps) {
  const {
    permission, prefs, nickname, statusHtml,
    refreshPermission, requestPermission,
    savePrefs, saveNickname, sendTestNotification,
  } = useNotifications();

  // Refresh state whenever modal opens
  useEffect(() => {
    if (isOpen) refreshPermission();
  }, [isOpen, refreshPermission]);

  const isGranted  = permission === 'granted';
  const isDenied   = permission === 'denied';
  const isDefault  = permission === 'default';
  const isSupported = permission !== 'unsupported';

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleRequestPermission = async () => {
    onClose();
    const perm = await requestPermission();
    if (perm === 'granted') {
      onToast('✅ Notifikasi berhasil diaktifkan!', 'success');
    }
  };

  const handleTest = () => {
    onClose();
    sendTestNotification();
    onToast('🧪 Test dikirim — minimize app lalu cek lock screen!', 'success');
  };

  const handleDisable = () => {
    // Cannot programmatically revoke — show instructions
    const statusEl = document.getElementById('notif-status-text');
    if (statusEl) {
      statusEl.innerHTML = '🔕 Untuk nonaktifkan notifikasi: Klik ikon <strong>🔒</strong> di address bar → Izin Situs → Notifikasi → <strong>Blokir</strong>, lalu refresh.';
    }
    const btnDisable = document.getElementById('notif-btn-disable');
    if (btnDisable) (btnDisable as HTMLButtonElement).style.display = 'none';
  };

  const handlePrefChange = (field: keyof NotifPrefs, value: boolean | string) => {
    savePrefs({ ...prefs, [field]: value });
  };

  return (
    <div
      className={`overlay${isOpen ? ' open' : ''}`}
      id="notif-overlay"
      onClick={handleOverlayClick}
      style={{ zIndex: 9999 }}
    >
      <div className="modal" style={{ maxWidth: '400px', width: '92%' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, letterSpacing: '1px' }}>🔔 NOTIFIKASI</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Status badge */}
          <div id="notif-status-box" style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg3)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.65 }}>
            <div
              id="notif-status-text"
              dangerouslySetInnerHTML={{ __html: statusHtml }}
            />
          </div>

          {/* Settings — only shown when granted */}
          {isGranted && (
            <div id="notif-settings" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                Pilih Notifikasi
              </div>

              {/* Nama Panggilan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px 12px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>👤 Nama Panggilan</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Untuk sapaan di notifikasi. Kosongkan = pakai nama profil</div>
                  </div>
                </div>
                <input
                  type="text"
                  id="notif-pref-nickname"
                  placeholder="Contoh: Bos, Sultan, Ferdy..."
                  maxLength={20}
                  value={nickname}
                  onChange={e => saveNickname(e.target.value)}
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 11px', fontFamily: "'Outfit',sans-serif", fontSize: '12px', color: 'var(--text)', outline: 'none', transition: 'all .2s', width: '100%' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)'; e.target.style.background = 'var(--gold-bg)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--input-bg)'; }}
                />
              </div>

              {/* Berita High Impact */}
              <label className="notif-toggle-row">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>📰 Berita High Impact</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Alert saat ada berita NFP, CPI, Fed Rate, dll</div>
                </div>
                <input
                  type="checkbox"
                  id="notif-pref-news"
                  checked={prefs.news}
                  onChange={e => handlePrefChange('news', e.target.checked)}
                />
              </label>

              {/* Pengingat Jurnal */}
              <label className="notif-toggle-row">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>⏰ Pengingat Jurnal Harian</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Ingatkan untuk mengisi jurnal trading hari ini</div>
                </div>
                <input
                  type="checkbox"
                  id="notif-pref-reminder"
                  checked={prefs.reminder}
                  onChange={e => handlePrefChange('reminder', e.target.checked)}
                />
              </label>

              {/* Jam Pengingat */}
              <label className="notif-toggle-row" style={{ alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>🕐 Jam Pengingat</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Waktu pengingat jurnal harian (WIB)</div>
                </div>
                <input
                  type="time"
                  id="notif-pref-time"
                  value={prefs.time}
                  onChange={e => handlePrefChange('time', e.target.value)}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }}
                />
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            {/* Test — only when granted */}
            {isGranted && (
              <button
                id="notif-btn-test"
                onClick={handleTest}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '10px', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd2)', color: 'var(--gold2)', fontFamily: "'Outfit',sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .2s', WebkitTapHighlightColor: 'transparent' }}
              >
                🧪 Uji Coba Notifikasi
              </button>
            )}

            {/* Disable — only when granted */}
            {isGranted && (
              <button
                id="notif-btn-disable"
                onClick={handleDisable}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', fontFamily: "'Outfit',sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .2s', WebkitTapHighlightColor: 'transparent' }}
              >
                🔕 Nonaktifkan Notifikasi
              </button>
            )}

            {/* Enable — when default (not yet requested) */}
            {isDefault && isSupported && (
              <button
                id="notif-btn-enable"
                onClick={handleRequestPermission}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '10px', background: 'var(--gold)', border: 'none', color: '#080808', fontFamily: "'Outfit',sans-serif", fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .2s', WebkitTapHighlightColor: 'transparent' }}
              >
                🔔 Aktifkan Notifikasi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}