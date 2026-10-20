// components/admin/ConfirmModal.tsx
// Modal konfirmasi aksi admin. Untuk 'block' dan 'revoke' ada input alasan
// yang disimpan ke profiles.block_reason dan ditampilkan ke user saat login.
'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';

const CONTENT: Record<string, { icon: string; title: string; desc: string; btn: string; cls: string }> = {
  revoke: {
    icon: '⛔',
    title: 'Cabut Akses License Key?',
    desc: 'Customer tidak akan bisa login. Aksi ini bisa di-restore.',
    btn: 'Ya, Cabut Akses',
    cls: 'modal-confirm',
  },
  restore: {
    icon: '♻️',
    title: 'Restore License Key?',
    desc: 'Key ini akan diaktifkan kembali.',
    btn: 'Ya, Restore',
    cls: 'modal-restore-btn',
  },
  block: {
    icon: '🚫',
    title: 'Blokir Akun User?',
    desc: 'User tidak akan bisa login ke aplikasi sampai di-aktifkan kembali.',
    btn: 'Ya, Blokir Akun',
    cls: 'modal-confirm',
  },
  unblock: {
    icon: '🔓',
    title: 'Aktifkan Kembali Akun?',
    desc: 'User akan bisa login kembali ke aplikasi.',
    btn: 'Ya, Aktifkan',
    cls: 'modal-restore-btn',
  },
};

const NEEDS_REASON = ['block', 'revoke'];
const MIN_REASON = 3;
const MAX_REASON = 200;

export default function ConfirmModal() {
  const pendingAction = useAdminStore((s) => s.pendingAction);
  const setPendingAction = useAdminStore((s) => s.setPendingAction);
  const { confirmAction } = useLicenseKeys();
  const [reason, setReason] = useState('');

  // Kosongkan input setiap kali modal dibuka / ditutup
  useEffect(() => {
    setReason('');
  }, [pendingAction]);

  const open = !!pendingAction;
  const content = pendingAction ? CONTENT[pendingAction.type] : null;
  const keyOrEmail = pendingAction
    ? 'key' in pendingAction
      ? pendingAction.key
      : pendingAction.email
    : '';

  const needsReason = !!pendingAction && NEEDS_REASON.includes(pendingAction.type);
  const reasonOk = reason.trim().length >= MIN_REASON;
  const disabled = needsReason && !reasonOk;

  return (
    <div id="modal-overlay" className={open ? 'show' : ''}>
      <div className="modal">
        <div className="modal-icon">{content?.icon || '⚠️'}</div>
        <div className="modal-title">{content?.title || 'Konfirmasi Aksi'}</div>
        <div className="modal-desc">{content?.desc || 'Yakin ingin melanjutkan?'}</div>
        <div className="modal-key">{keyOrEmail}</div>

        {needsReason && (
          <div style={{ margin: '14px 0 4px', textAlign: 'left' }}>
            <label
              style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}
            >
              Alasan (akan dilihat user saat mencoba login)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="Contoh: Pembayaran tidak valid / melanggar ketentuan"
              rows={3}
              style={{
                width: '100%',
                resize: 'none',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg4)',
                color: 'inherit',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
              {reason.length}/{MAX_REASON}
            </div>
          </div>
        )}

        <div className="modal-btns">
          <button className="modal-cancel" onClick={() => setPendingAction(null)}>
            Batal
          </button>
          <button
            className={content?.cls || 'modal-confirm'}
            disabled={disabled}
            style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            onClick={() => confirmAction(needsReason ? reason.trim() : undefined)}
          >
            {content?.btn || 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
