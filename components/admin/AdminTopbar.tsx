// components/admin/AdminTopbar.tsx
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminTopbar() {
  const adminLabel = useAdminStore((s) => s.adminLabel);
  const { doLogout } = useAdminAuth();

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <span className="brand">
          <span style={{ color: 'var(--text)' }}>Journal</span>
          <em style={{ color: 'var(--gold2)' }}>yze</em>
        </span>
        <span className="brand-separator" />
        <span className="brand-tag">Admin Panel</span>
      </div>

      <div className="admin-topbar-right">
        <span className="admin-label">
          <span className="admin-label-dot" />
          {adminLabel}
        </span>
        <button className="logout-btn" onClick={doLogout}>
          Keluar
        </button>
      </div>
    </header>
  );
}
