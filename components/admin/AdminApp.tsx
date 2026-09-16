// components/admin/AdminApp.tsx
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import LoginScreen from './LoginScreen';
import Topbar from './Topbar';
import KeysPanel from './KeysPanel';
import AnalyticsPanel from './AnalyticsPanel';
import PixelPanel from './PixelPanel';
import UsersPanel from './UsersPanel';
import PromoPanel from './PromoPanel';
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
      <PixelPanel active={activeTab === 'pixel'} />
      <UsersPanel active={activeTab === 'users'} />
      <PromoPanel active={activeTab === 'promos'} />
      <ConfirmModal />
      <Toast />
    </>
  );
}