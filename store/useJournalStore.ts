'use client'

// store/useJournalStore.ts
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Trade } from '@/lib/types';

export type JournalPage = 'home' | 'risk' | 'plan' | 'data' | 'filter' | 'weekly' | 'monthly' | 'news' | 'profile' | 'gallery';
export type UserPlan = 'free' | 'basic' | 'pro' | 'elite';

export const BN_MAIN: JournalPage[] = ['home', 'risk', 'plan', 'data', 'filter'];
export const BN_MORE: JournalPage[] = ['weekly', 'monthly', 'news', 'gallery'];

type Toast = { id: number; msg: string; type: 'success' | 'error' };
type ConfirmState = { title: string; msg: string; confirmLabel: string; onConfirm: () => void } | null;

interface JournalState {
  currentUser: User | null;
  authOverlayVisible: boolean;
  cloudLoading: boolean;
  setCurrentUser: (u: User | null) => void;
  setAuthOverlayVisible: (v: boolean) => void;
  setCloudLoading: (v: boolean) => void;

  displayName: string;
  setDisplayName: (n: string) => void;

  userPlan: UserPlan;
  setPlan: (p: UserPlan) => void;

  isDemoMode: boolean;
  setDemoMode: (v: boolean) => void;

  splashHiding: boolean;
  splashHidden: boolean;
  closeSplash: () => void;

  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;

  activePage: JournalPage;
  setActivePage: (p: JournalPage) => void;

  userMenuOpen: boolean;
  toggleUserMenu: () => void;
  closeUserMenu: () => void;
  moreDrawerOpen: boolean;
  toggleMoreDrawer: () => void;
  closeMoreDrawer: () => void;

  toasts: Toast[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  removeToast: (id: number) => void;

  confirmModal: ConfirmState;
  showConfirmModal: (title: string, msg: string, confirmLabel: string, onConfirm: () => void) => void;
  closeConfirmModal: () => void;

  // ── Trade Breakdown ────────────────────────────────────────────────────────
  breakdownTrade: Trade | null;
  breakdownList: Trade[];
  breakdownIndex: number;
  openBreakdown: (trade: Trade, list: Trade[]) => void;
  closeBreakdown: () => void;
  setBreakdownIndex: (i: number) => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  currentUser: null,
  authOverlayVisible: true,
  cloudLoading: false,
  setCurrentUser: (currentUser) => set({ currentUser }),
  setAuthOverlayVisible: (authOverlayVisible) => set({ authOverlayVisible }),
  setCloudLoading: (cloudLoading) => set({ cloudLoading }),

  displayName: '',
  setDisplayName: (displayName) => set({ displayName }),

  userPlan: 'free',
  setPlan: (userPlan) => set({ userPlan }),

  isDemoMode: false,
  setDemoMode: (isDemoMode) => set({ isDemoMode }),

  splashHiding: false,
  splashHidden: false,
  closeSplash: () => {
    if (get().splashHiding || get().splashHidden) return;
    set({ splashHiding: true });
    setTimeout(() => set({ splashHidden: true }), 850);
  },

  theme: 'dark',
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jz_theme', theme);
  },

  activePage: 'home',
  setActivePage: (id) => {
    set({ activePage: id });
    localStorage.setItem('jz_last_tab', id);
  },

  userMenuOpen: false,
  toggleUserMenu: () => set((s) => ({ userMenuOpen: !s.userMenuOpen })),
  closeUserMenu: () => set({ userMenuOpen: false }),
  moreDrawerOpen: false,
  toggleMoreDrawer: () => set((s) => ({ moreDrawerOpen: !s.moreDrawerOpen })),
  closeMoreDrawer: () => set({ moreDrawerOpen: false }),

  toasts: [],
  showToast: (msg, type = 'success') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => get().removeToast(id), 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  confirmModal: null,
  showConfirmModal: (title, msg, confirmLabel, onConfirm) =>
    set({ confirmModal: { title, msg, confirmLabel, onConfirm } }),
  closeConfirmModal: () => set({ confirmModal: null }),

  // ── Breakdown ──────────────────────────────────────────────────────────────
  breakdownTrade: null,
  breakdownList: [],
  breakdownIndex: 0,

  openBreakdown: (trade, list) => {
    const idx = list.findIndex((t) => t.id === trade.id);
    set({
      breakdownTrade: trade,
      breakdownList: list,
      breakdownIndex: idx >= 0 ? idx : 0,
    });
  },

  closeBreakdown: () => set({ breakdownTrade: null, breakdownList: [], breakdownIndex: 0 }),

  setBreakdownIndex: (i) => {
    const { breakdownList } = get();
    if (i < 0 || i >= breakdownList.length) return;
    set({ breakdownTrade: breakdownList[i], breakdownIndex: i });
  },
}));
