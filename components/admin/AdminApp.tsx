// components/admin/AdminApp.tsx
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import LoginScreen from './LoginScreen';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AdminTopbar from './AdminTopbar';
import KeysPanel from './KeysPanel';
import AnalyticsPanel from './AnalyticsPanel';
import DashboardPanel from './DashboardPanel';
import PixelPanel from './PixelPanel';
import MetaAnalyticsPanel from './MetaAnalyticsPanel';
import UsersPanel from './UsersPanel';
import PromoPanel from './PromoPanel';
import AffiliatePanel from './AffiliatePanel';
import LeadsPanel from './LeadsPanel';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';

export default function AdminApp() {
  const authStatus      = useAdminStore((s) => s.authStatus);
  const activeTab       = useAdminStore((s) => s.activeTab);
  const usersSubTab     = useAdminStore((s) => s.usersSubTab);
  const marketingSubTab = useAdminStore((s) => s.marketingSubTab);
  const pixelSubTab     = useAdminStore((s) => s.pixelSubTab);

  if (authStatus !== 'loggedIn') {
    return <LoginScreen />;
  }

  return (
    <div className="admin-layout">
      <AdminTopbar />

      <div className="admin-body">
        <Sidebar />

        <main className="admin-content">

          {/* DASHBOARD → tracking landing page utama */}
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <DashboardPanel active={activeTab === 'dashboard'} />
          </div>

          {/* USERS → 3 sub-tab: Management + License Keys + Analytic */}
          <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
            <SubTabBar
              tabs={[
                { id: 'management', label: 'Management'   },
                { id: 'keys',       label: 'License Keys' },
                { id: 'analytics',  label: 'Analytic'     },
              ]}
              active={usersSubTab}
              onChange={(t) => useAdminStore.getState().setUsersSubTab(t as typeof usersSubTab)}
            />
            <div style={{ display: usersSubTab === 'management' ? 'block' : 'none' }}>
              <UsersPanel active={activeTab === 'users' && usersSubTab === 'management'} />
            </div>
            <div style={{ display: usersSubTab === 'keys' ? 'block' : 'none' }}>
              <KeysPanel active={activeTab === 'users' && usersSubTab === 'keys'} />
            </div>
            <div style={{ display: usersSubTab === 'analytics' ? 'block' : 'none' }}>
              <AnalyticsPanel active={activeTab === 'users' && usersSubTab === 'analytics'} />
            </div>
          </div>

          {/* MARKETING → 2 sub-tab */}
          <div style={{ display: activeTab === 'marketing' ? 'block' : 'none' }}>
            <SubTabBar
              tabs={[
                { id: 'promo', label: 'Promo Codes' },
                { id: 'leads', label: 'Leads'       },
              ]}
              active={marketingSubTab}
              onChange={(t) => useAdminStore.getState().setMarketingSubTab(t as typeof marketingSubTab)}
            />
            <div style={{ display: marketingSubTab === 'promo' ? 'block' : 'none' }}>
              <PromoPanel active={activeTab === 'marketing' && marketingSubTab === 'promo'} />
            </div>
            <div style={{ display: marketingSubTab === 'leads' ? 'block' : 'none' }}>
              <LeadsPanel active={activeTab === 'marketing' && marketingSubTab === 'leads'} />
            </div>
          </div>

          {/* AFFILIATE */}
          <div style={{ display: activeTab === 'affiliate' ? 'block' : 'none' }}>
            <AffiliatePanel active={activeTab === 'affiliate'} />
          </div>

          {/* PIXEL */}
          <div style={{ display: activeTab === 'pixel' ? 'block' : 'none' }}>
            <SubTabBar
              tabs={[
                { id: 'settings', label: 'Pengaturan Pixel' },
                { id: 'meta',     label: 'Analitik Meta' },
              ]}
              active={pixelSubTab}
              onChange={(t) => useAdminStore.getState().setPixelSubTab(t as typeof pixelSubTab)}
            />
            <div style={{ display: pixelSubTab === 'settings' ? 'block' : 'none' }}>
              <PixelPanel active={activeTab === 'pixel' && pixelSubTab === 'settings'} />
            </div>
            <div style={{ display: pixelSubTab === 'meta' ? 'block' : 'none' }}>
              <MetaAnalyticsPanel active={activeTab === 'pixel' && pixelSubTab === 'meta'} />
            </div>
          </div>

        </main>
      </div>

      <BottomNav />
      <ConfirmModal />
      <Toast />
    </div>
  );
}

function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="sub-tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`sub-tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
