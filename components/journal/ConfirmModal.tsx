// components/journal/ConfirmModal.tsx
// Dipindah dari index.html baris 3298-3308 (markup #cmodal-overlay) +
// showConfirmModal()/closeConfirmModal() (baris 6047-6061). Dipanggil
// lewat useJournalStore().showConfirmModal(title,msg,label,onConfirm) —
// reusable untuk semua konfirmasi hapus/dst di Phase berikutnya.
'use client';

import { useJournalStore } from '@/store/useJournalStore';

export default function ConfirmModal() {
  const confirmModal = useJournalStore((s) => s.confirmModal);
  const closeConfirmModal = useJournalStore((s) => s.closeConfirmModal);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeConfirmModal(); // index.html baris 6059-6061
  };

  return (
    <div className={`cmodal-overlay ${confirmModal ? 'open' : ''}`} onClick={onOverlayClick}>
      <div className="cmodal-box">
        <div className="cmodal-title">{confirmModal?.title}</div>
        <div className="cmodal-msg">{confirmModal?.msg}</div>
        <div className="cmodal-btns">
          <button className="cmodal-cancel" onClick={closeConfirmModal}>
            Batal
          </button>
          <button
            className="cmodal-confirm"
            onClick={() => {
              closeConfirmModal();
              confirmModal?.onConfirm();
            }}
          >
            {confirmModal?.confirmLabel || 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
}