// store/useJournalStore.ts
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

export type JournalPage = 'home' | 'risk' | 'plan' | 'data' | 'filter' | 'weekly' | 'monthly' | 'news';

export const BN_MAIN: JournalPage[] = ['home', 'risk', 'plan', 'data', 'filter'];
export const BN_MORE: JournalPage[] = ['weekly', 'monthly', 'news'];

type Toast = { id: number; msg: string; type: 'success' | 'error' };
type ConfirmState = { title: string; msg: string; confirmLabel: string; onConfirm: () => void } | null;

interface JournalState {
  currentUser: User | null;
  authOverlayVisible: boolean;
  cloudLoading: boolean;
  setCurrentUser: (u: User | null) => void;
  setAuthOverlayVisible: (v: boolean) => void;
  setCloudLoading: (v: boolean) => void;

  // Phase 13: display name dari tabel profiles
  displayName: string;
  setDisplayName: (n: string) => void;

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
}));