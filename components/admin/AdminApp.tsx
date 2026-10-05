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
      <div style={{ display: activeTab === 'keys'      ? 'block' : 'none' }}><KeysPanel      active={activeTab === 'keys'}      /></div>
      <div style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}><AnalyticsPanel active={activeTab === 'analytics'} /></div>
      <div style={{ display: activeTab === 'pixel'     ? 'block' : 'none' }}><PixelPanel     active={activeTab === 'pixel'}     /></div>
      <div style={{ display: activeTab === 'users'     ? 'block' : 'none' }}><UsersPanel     active={activeTab === 'users'}     /></div>
      <div style={{ display: activeTab === 'promos'    ? 'block' : 'none' }}><PromoPanel     active={activeTab === 'promos'}    /></div>
      <ConfirmModal />
      <Toast />
    </>
  );
}