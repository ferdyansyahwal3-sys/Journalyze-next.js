'use client'

// store/useAdminStore.ts
import { create } from 'zustand';
import type { LicenseKey, PendingAction, UserAnalytics } from '@/lib/types';

export const PAGE_SIZE = 20;

type AuthStatus = 'checking' | 'loggedOut' | 'loggedIn';
type Tab = 'keys' | 'analytics' | 'pixel' | 'users' | 'promos';
type Toast = { msg: string; type: 'success' | 'error' | ''; id: number } | null;

export type UserPlan = 'free' | 'basic' | 'pro' | 'elite';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  plan: UserPlan;
  is_activated: boolean;
  created_at: string;
}

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

  // users
  allUsers: UserProfile[];
  usersLoaded: boolean;
  usersSearch: string;
  usersPlanFilter: 'all' | UserPlan;
  usersPage: number;
  setAllUsers: (u: UserProfile[]) => void;
  setUsersLoaded: (v: boolean) => void;
  setUsersSearch: (q: string) => void;
  setUsersPlanFilter: (f: 'all' | UserPlan) => void;
  setUsersPage: (p: number) => void;
  updateUserPlan: (id: string, plan: UserPlan) => void;
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

  // users
  allUsers: [],
  usersLoaded: false,
  usersSearch: '',
  usersPlanFilter: 'all',
  usersPage: 1,
  setAllUsers: (allUsers) => set({ allUsers }),
  setUsersLoaded: (usersLoaded) => set({ usersLoaded }),
  setUsersSearch: (usersSearch) => set({ usersSearch, usersPage: 1 }),
  setUsersPlanFilter: (usersPlanFilter) => set({ usersPlanFilter, usersPage: 1 }),
  setUsersPage: (usersPage) => set({ usersPage }),
  updateUserPlan: (id, plan) =>
    set((s) => ({
      allUsers: s.allUsers.map((u) => (u.id === id ? { ...u, plan } : u)),
    })),
}));