// components/admin/Toast.tsx — dipindah dari admin.html showToast() baris 668
'use client';

import { useAdminStore } from '@/store/useAdminStore';

export default function Toast() {
  const toast = useAdminStore((s) => s.toast);
  return (
    <div id="toast" className={toast ? `show ${toast.type}` : ''}>
      {toast?.msg || ''}
    </div>
  );
}
