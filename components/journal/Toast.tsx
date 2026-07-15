// components/journal/Toast.tsx
// Dipindah dari index.html baris 3310 (markup #toast-root) + toast()
// function (baris 6063-6085). Dipanggil lewat useJournalStore().showToast(),
// reusable untuk semua Phase berikutnya (ganti pemanggilan toast(msg,type) manapun).
'use client';

import { useJournalStore } from '@/store/useJournalStore';

export default function Toast() {
  const toasts = useJournalStore((s) => s.toasts);

  return (
    <div id="toast-root" style={{ position: 'fixed', bottom: 22, right: 18, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: 'var(--bg2)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${t.type === 'success' ? 'var(--gold2)' : 'var(--red)'}`,
            borderRadius: 9,
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 200,
            animation: 'toastIn .2s ease',
          }}
        >
          <span style={{ fontSize: 14 }}>{t.type === 'success' ? '✓' : '✗'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}