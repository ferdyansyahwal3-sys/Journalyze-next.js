// store/useAdminStore.ts
// Extended: tambah tab 'pixel' untuk PixelPanel
import { create } from 'zustand';
import type { LicenseKey, PendingAction, UserAnalytics } from '@/lib/types';

export const PAGE_SIZE = 20;

type AuthStatus = 'checking' | 'loggedOut' | 'loggedIn';
type Tab = 'keys' | 'analytics' | 'pixel';
type Toast = { msg: string; type: 'success' | 'error' | ''; id: number } | null;

interface AdminState {
  // auth
  authStatus: AuthStatus;
  adminLabel: string;
  loginError: string;
  setAuthStatus: (s: AuthStatus) => void;
  setAdminLabel: (l: string) => void;
  setLoginError: (e: string) => void;

  // tabs
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;

  // keys
  allKeys: LicenseKey[];
  searchQuery: string;
  statusFilter: 'all' | 'unused' | 'used' | 'revoked';
  currentPage: number;
  setAllKeys: (k: LicenseKey[]) => void;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: 'all' | 'unused' | 'used' | 'revoked') => void;
  setCurrentPage: (p: number) => void;

  // modal
  pendingAction: PendingAction;
  setPendingAction: (a: PendingAction) => void;

  // toast
  toast: Toast;
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;

  // analytics
  analyticsLoaded: boolean;
  allUserData: UserAnalytics[];
  setAnalyticsLoaded: (v: boolean) => void;
  setAllUserData: (u: UserAnalytics[]) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  authStatus: 'checking',
  adminLabel: 'OWNER',
  loginError: '',
  setAuthStatus: (authStatus) => set({ authStatus }),
  setAdminLabel: (adminLabel) => set({ adminLabel }),
  setLoginError: (loginError) => set({ loginError }),

  activeTab: 'keys',
  setActiveTab: (activeTab) => set({ activeTab }),

  allKeys: [],
  searchQuery: '',
  statusFilter: 'all',
  currentPage: 1,
  setAllKeys: (allKeys) => set({ allKeys }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),

  pendingAction: null,
  setPendingAction: (pendingAction) => set({ pendingAction }),

  toast: null,
  showToast: (msg, type = '') => {
    const id = Date.now();
    set({ toast: { msg, type, id } });
    setTimeout(() => {
      set((s) => (s.toast?.id === id ? { toast: null } : {}));
    }, 3000);
  },

  analyticsLoaded: false,
  allUserData: [],
  setAnalyticsLoaded: (analyticsLoaded) => set({ analyticsLoaded }),
  setAllUserData: (allUserData) => set({ allUserData }),
}));