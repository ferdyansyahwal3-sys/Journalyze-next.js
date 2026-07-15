// components/admin/ConfirmModal.tsx
// Dipindah dari admin.html: showRevokeModal/showRestoreModal/showBlockModal/
// showUnblockModal/closeModal (baris 637-643) — 4 fungsi show*Modal yang
// mirip disatukan jadi 1 komponen deklaratif berdasar `pendingAction`.
'use client';

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

export default function ConfirmModal() {
  const pendingAction = useAdminStore((s) => s.pendingAction);
  const setPendingAction = useAdminStore((s) => s.setPendingAction);
  const { confirmAction } = useLicenseKeys();

  const open = !!pendingAction;
  const content = pendingAction ? CONTENT[pendingAction.type] : null;
  const keyOrEmail = pendingAction
    ? 'key' in pendingAction
      ? pendingAction.key
      : pendingAction.email
    : '';

  return (
    <div id="modal-overlay" className={open ? 'show' : ''}>
      <div className="modal">
        <div className="modal-icon">{content?.icon || '⚠️'}</div>
        <div className="modal-title">{content?.title || 'Konfirmasi Aksi'}</div>
        <div className="modal-desc">{content?.desc || 'Yakin ingin melanjutkan?'}</div>
        <div className="modal-key">{keyOrEmail}</div>
        <div className="modal-btns">
          <button className="modal-cancel" onClick={() => setPendingAction(null)}>
            Batal
          </button>
          <button className={content?.cls || 'modal-confirm'} onClick={confirmAction}>
            {content?.btn || 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
