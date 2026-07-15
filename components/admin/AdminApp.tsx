// components/admin/AdminApp.tsx
// Pengganti kerangka admin.html: menampilkan LoginScreen selama authStatus
// belum 'loggedIn', lalu render Topbar + panel aktif — setara dengan
// toggle display:none/flex manual di checkAdminAccess() versi lama.
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import LoginScreen from './LoginScreen';
import Topbar from './Topbar';
import KeysPanel from './KeysPanel';
import AnalyticsPanel from './AnalyticsPanel';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';

export default function AdminApp() {
  const authStatus = useAdminStore((s) => s.authStatus);
  const activeTab = useAdminStore((s) => s.activeTab);

  if (authStatus !== 'loggedIn') {
    return <LoginScreen />;
  }

  return (
    <>
      <Topbar />
      <KeysPanel active={activeTab === 'keys'} />
      <AnalyticsPanel active={activeTab === 'analytics'} />
      <ConfirmModal />
      <Toast />
    </>
  );
}
