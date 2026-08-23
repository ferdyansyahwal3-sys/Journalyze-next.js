// components/admin/AdminApp.tsx
// Extended: tambah PixelPanel untuk tab 'pixel'
'use client';

import { useAdminStore } from '@/store/useAdminStore';
import LoginScreen from './LoginScreen';
import Topbar from './Topbar';
import KeysPanel from './KeysPanel';
import AnalyticsPanel from './AnalyticsPanel';
import PixelPanel from './PixelPanel';
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
      <ConfirmModal />
      <Toast />
    </>
  );
}