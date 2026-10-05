// components/admin/Topbar.tsx
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function Topbar() {
  const adminLabel = useAdminStore((s) => s.adminLabel);
  const activeTab  = useAdminStore((s) => s.activeTab);
  const setActiveTab = useAdminStore((s) => s.setActiveTab);
  const { doLogout } = useAdminAuth();

  return (
    <>
      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="brand">
            <span style={{ color: 'var(--text)' }}>Journal</span>
            <em style={{ color: 'var(--gold2)' }}>yze</em>
          </span>
          <span className="brand-separator" />
          <span className="brand-tag">Admin Panel</span>
        </div>

        <div className="topbar-right">
          <span className="admin-label">
            <span className="admin-label-dot" />
            {adminLabel}
          </span>
          <button className="logout-btn" onClick={doLogout}>
            Keluar
          </button>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="tab-nav">
        {[
          { id: 'keys',      icon: '🔑', label: 'License Keys'     },
          { id: 'analytics', icon: '📊', label: 'Usage Analytics'  },
          { id: 'pixel',     icon: '📡', label: 'Pixel Tracking'   },
          { id: 'users',     icon: '👥', label: 'User Management'  },
          { id: 'promos',    icon: '🎟️', label: 'Promo Codes'     },
        ].map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </>
  );
}