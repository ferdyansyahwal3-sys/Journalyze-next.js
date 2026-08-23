// components/admin/Topbar.tsx — tambah tab Pixel
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function Topbar() {
  const adminLabel = useAdminStore((s) => s.adminLabel);
  const activeTab = useAdminStore((s) => s.activeTab);
  const setActiveTab = useAdminStore((s) => s.setActiveTab);
  const { doLogout } = useAdminAuth();

  return (
    <>
      <div className="topbar">
        <div>
          <span className="brand">
            Journal<em>yze</em>
          </span>
          <span className="brand-tag">Admin Panel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
            ⚡ <span>{adminLabel}</span>
          </span>
          <button className="logout-btn" onClick={doLogout}>
            Keluar
          </button>
        </div>
      </div>

      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          🔑 License Keys
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Usage Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'pixel' ? 'active' : ''}`}
          onClick={() => setActiveTab('pixel')}
        >
          📡 Pixel Tracking
        </button>
      </div>
    </>
  );
}