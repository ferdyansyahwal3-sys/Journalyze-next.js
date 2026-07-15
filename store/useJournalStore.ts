// store/useJournalStore.ts
// Pengganti variabel global & DOM state di index.html:
// window._currentUser, activePage (lewat class .page.active),
// theme (data-theme attr), splash/auth overlay visibility,
// user-menu/more-drawer open state, toast-root, cmodal-overlay.
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

export type JournalPage = 'home' | 'risk' | 'plan' | 'data' | 'filter' | 'weekly' | 'monthly' | 'news';

export const BN_MAIN: JournalPage[] = ['home', 'risk', 'plan', 'data', 'filter'];
export const BN_MORE: JournalPage[] = ['weekly', 'monthly', 'news'];

type Toast = { id: number; msg: string; type: 'success' | 'error' };
type ConfirmState = { title: string; msg: string; confirmLabel: string; onConfirm: () => void } | null;

interface JournalState {
  // auth
  currentUser: User | null;
  authOverlayVisible: boolean;
  cloudLoading: boolean;
  setCurrentUser: (u: User | null) => void;
  setAuthOverlayVisible: (v: boolean) => void;
  setCloudLoading: (v: boolean) => void;

  // splash — index.html baris 3346-3352 (auto-close 6 detik)
  splashHiding: boolean;
  splashHidden: boolean;
  closeSplash: () => void;

  // theme — index.html baris 3353 (setTheme)
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;

  // navigasi — pengganti switchPage() (index.html baris 3358-3385)
  activePage: JournalPage;
  setActivePage: (p: JournalPage) => void;

  // topbar / drawer
  userMenuOpen: boolean;
  toggleUserMenu: () => void;
  closeUserMenu: () => void;
  moreDrawerOpen: boolean;
  toggleMoreDrawer: () => void;
  closeMoreDrawer: () => void;

  // toast generik — pengganti toast() global (index.html baris 6063-6085)
  toasts: Toast[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  removeToast: (id: number) => void;

  // confirm modal generik — pengganti showConfirmModal()/closeConfirmModal() (baris 6047-6061)
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

  splashHiding: false,
  splashHidden: false,
  closeSplash: () => {
    if (get().splashHiding || get().splashHidden) return;
    set({ splashHiding: true });
    // index.html: setTimeout(()=>{ splash.style.display='none'; }, 850)
    setTimeout(() => set({ splashHidden: true }), 850);
  },

  theme: 'dark',
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jz_theme', theme);
    // TODO Phase 4+: kalau sudah login & persistSettings tersedia, sync ke cloud
    // juga (index.html baris 3353: if(window.persistSettings) ...)
  },

  activePage: 'home',
  setActivePage: (id) => {
    set({ activePage: id });
    localStorage.setItem('jz_last_tab', id);
    // NOTE: pemanggilan render per-halaman (recalcAll/renderDataTable/renderFilter/
    // buildPlan/dst — index.html baris 3367-3384) akan dikerjakan di masing-masing
    // komponen halaman pada Phase 4+ lewat prop `active`, pola yang sama seperti
    // KeysPanel/AnalyticsPanel di /admin.
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