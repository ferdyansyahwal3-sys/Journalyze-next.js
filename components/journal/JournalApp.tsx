// components/journal/JournalApp.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useJournalStore, type JournalPage } from '@/store/useJournalStore';
import { useTradeStore } from '@/store/useTradeStore';
import { usePlan } from '@/hooks/usePlan';
import { FAKE_TRADES } from '@/lib/fakeTradeData';
import { _sb } from '@/lib/supabaseClient';
import Splash from './Splash';
import AuthOverlay from './AuthOverlay';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PageHome from './PageHome';
import dynamic from 'next/dynamic';
const PageRisk    = dynamic(() => import('./PageRisk'),    { ssr: false });
const PageGallery = dynamic(() => import('./PageGallery'), { ssr: false });
import PagePlan from './PagePlan';
import PageData from './PageData';
import PageFilter from './PageFilter';
import PageWeekly from './PageWeekly';
import PageMonthly from './PageMonthly';
import PageNews from './PageNews';
import ApiKeyModal from './ApiKeyModal';
import NotifModal from './NotifModal';
import PageProfile from './PageProfile';
import DemoBanner from './DemoBanner';
import TrialBanner from './TrialBanner';
import PlanLockOverlay from './PlanLockOverlay';
import PaymentSuccessModal from './PaymentSuccessModal';
import TradeBreakdown from './TradeBreakdown';

const EXPIRED_COPY = {
  trial:   { title: 'Trial 2 Hari Kamu Sudah Berakhir', body: 'Terima kasih sudah mencoba Journalyze. Akun kamu kembali ke paket Free, dan data trading kamu tetap tersimpan.' },
  basic:   { title: 'Paket Basic Kamu Sudah Berakhir',  body: 'Akun kamu kembali ke paket Free. Data trading kamu tetap tersimpan.' },
  generic: { title: 'Masa Aktif Paket Kamu Sudah Berakhir', body: 'Akun kamu sekarang di paket Free. Data trading kamu tetap tersimpan.' },
} as const;

function readApiKeyActive(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    localStorage.getItem('jz_gemini_key') ||
    localStorage.getItem('jz_anthropic_key')
  );
}
function readNotifGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export default function JournalApp() {
  const activePage    = useJournalStore((s) => s.activePage);
  const setActivePage = useJournalStore((s) => s.setActivePage);
  const showToast     = useJournalStore((s) => s.showToast);
  const currentUser   = useJournalStore((s) => s.currentUser);
  const trialAvailable = useJournalStore((s) => s.trialAvailable);
  const switchPage = (page: string) => setActivePage(page as JournalPage);

  const { isFree, isTrial, canFilter, canMonthly, canAI, canPhotoMT5 } = usePlan();

  // Mode demo (data palsu) hanya untuk free yang BELUM pernah trial/berbayar.
  // Free yang trialnya sudah habis (trial_used = true) melihat data aslinya sendiri.
  const demoMode = isFree && trialAvailable;

  const [apiKeyOpen,    setApiKeyOpen]    = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [apiKeyActive,  setApiKeyActive]  = useState(false);
  const [notifGranted,  setNotifGranted]  = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const [trialBusy,     setTrialBusy]     = useState(false);
  const welcomeHandled = useRef(false);
  const expiredToastFor = useRef<string | null>(null);
  const splashHidden = useJournalStore((s) => s.splashHidden);
  const [expiredPopup, setExpiredPopup] = useState<'trial' | 'basic' | 'generic' | null>(null);
  const [popupFallback, setPopupFallback] = useState(false);

  // ── Mode demo untuk user free ──
  // FIX RACE: PageData memanggil loadCloud(userId) saat currentUser terisi (effect child jalan
  // lebih dulu dari effect ini), dan loadCloud selesai BELAKANGAN lalu menimpa FAKE_TRADES dengan
  // data asli. Solusinya: pasang subscriber — setiap kali data demo hilang dari store
  // (tertimpa loadCloud), pasang ulang FAKE_TRADES. Data asli di DB tidak disentuh.
  useEffect(() => {
    if (!currentUser || !demoMode) return;

    const hasDemo = () => useTradeStore.getState().trades.some((t) => String(t.id).startsWith('demo-'));
    const applyDemo = () => {
      if (hasDemo()) return;
      // dwList ikut dikosongkan supaya saldo demo tidak tercampur deposit/withdraw asli
      useTradeStore.setState({ trades: FAKE_TRADES, dwList: [], loaded: true });
    };

    applyDemo();
    const unsubscribe = useTradeStore.subscribe(applyDemo);

    const shownKey = `jz_demo_popup_shown_${currentUser.id}`;
    if (!sessionStorage.getItem(shownKey)) {
      setShowDemoPopup(true);
      sessionStorage.setItem(shownKey, '1');
    }

    return unsubscribe;
  }, [currentUser, demoMode]);

  // Kalau user naik dari free (demo) ke paket lain tanpa reload (mis. refreshPlan),
  // buang data demo dan muat ulang data asli dari cloud.
  useEffect(() => {
    if (!currentUser || demoMode) return;
    const stillDemo = useTradeStore.getState().trades.some((t) => String(t.id).startsWith('demo-'));
    if (stillDemo) useTradeStore.getState().loadCloud(currentUser.id);
  }, [currentUser, demoMode]);

  // Popup demo ditutup otomatis kalau mode demo berakhir
  useEffect(() => {
    if (!demoMode) setShowDemoPopup(false);
  }, [demoMode]);

  // ── Popup paket berakhir (setiap refresh / login) ──
  useEffect(() => {
    if (!currentUser) { expiredToastFor.current = null; return; }
    if (expiredToastFor.current === currentUser.id) return; // 1x per page load / login
    let reason: 'trial' | 'basic' | 'generic' | null = null;
    try {
      const expired = localStorage.getItem('jz_plan_expired');
      if (expired) {
        localStorage.removeItem('jz_plan_expired');
        reason = expired === 'trial' ? 'trial' : (expired === 'basic' || expired === '1') ? 'basic' : 'generic';
      } else if (isFree && !trialAvailable) {
        reason = 'generic'; // free yang jatah trial/paketnya sudah terpakai
      }
    } catch {}
    if (reason) {
      expiredToastFor.current = currentUser.id;
      setExpiredPopup(reason);
    }
  }, [currentUser, isFree, trialAvailable]);

  // Cadangan: kalau splash tidak memberi sinyal selesai, tampilkan popup setelah 4 detik
  useEffect(() => {
    if (!expiredPopup) return;
    const t = setTimeout(() => setPopupFallback(true), 4000);
    return () => clearTimeout(t);
  }, [expiredPopup]);

  // ── ?welcome=trial → toast sekali lalu bersihkan param ──
  useEffect(() => {
    if (!currentUser || welcomeHandled.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('welcome') !== 'trial') return;
    welcomeHandled.current = true;
    if (isTrial) {
      showToast('🎉 Trial 2 hari aktif! Semua fitur terbuka.', 'success');
    }
    url.searchParams.delete('welcome');
    window.history.replaceState({}, '', url.toString());
  }, [currentUser, isTrial]);

  useEffect(() => {
    const saved = (localStorage.getItem('jz_theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    useJournalStore.setState({ theme: saved });
    const lastTab = localStorage.getItem('jz_last_tab') as JournalPage | null;
    if (lastTab) setActivePage(lastTab);

    setApiKeyActive(readApiKeyActive());
    setNotifGranted(readNotifGranted());

    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam) setActivePage(pageParam as JournalPage);
  }, []);

  const handleApiKeySaved = useCallback((hasKey: boolean) => {
    setApiKeyActive(hasKey);
  }, []);

  const handleNotifClose = useCallback(() => {
    setNotifOpen(false);
    setNotifGranted(readNotifGranted());
  }, []);

  const handleToast = useCallback((msg: string, type: 'success' | 'error') => {
    showToast(msg, type);
  }, [showToast]);

  // ── Mulai trial dari popup demo ──
  const handleStartTrial = useCallback(async () => {
    if (trialBusy) return;
    setTrialBusy(true);
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showToast('Sesi habis. Silakan login ulang.', 'error');
        setTrialBusy(false);
        return;
      }

      const res  = await fetch('/api/trial/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({} as { success?: boolean; error?: string }));

      if (!res.ok || !json.success) {
        // 409 = jatah trial sudah terpakai → hentikan tawaran
        if (res.status === 409) useJournalStore.setState({ trialAvailable: false });
        showToast(json.error || 'Gagal memulai trial. Coba lagi.', 'error');
        setTrialBusy(false);
        return;
      }

      // Reload penuh supaya auth membaca plan trial & data demo dibuang
      window.location.href = '/journal?welcome=trial';
    } catch {
      showToast('Gagal terhubung ke server. Periksa koneksi internet.', 'error');
      setTrialBusy(false);
    }
  }, [trialBusy, showToast]);

  const userEmail = currentUser?.email || '';

  return (
    <>
      <AuthOverlay />
      <Splash />

      {currentUser && demoMode && <DemoBanner />}
      {currentUser && isTrial && <TrialBanner />}

      {showDemoPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#111', border: '1px solid #C9A84C44',
            borderRadius: 20, padding: '36px 28px',
            maxWidth: 400, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👀</div>
            <h2 style={{ color: '#C9A84C', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Kamu sedang di Mode Demo
            </h2>
            <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7, margin: '0 0 20px' }}>
              Data trading yang kamu lihat adalah <strong style={{ color: '#fff' }}>data palsu</strong> untuk
              keperluan demo saja. Data ini <strong style={{ color: '#e74c3c' }}>tidak tersimpan</strong> dan
              akan hilang saat kamu logout atau refresh.
            </p>
            <div style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 12, color: '#666', lineHeight: 1.6,
            }}>
              {trialAvailable
                ? '🎁 Mau coba dulu? Buka semua fitur gratis selama 2 hari, tanpa kartu kredit.'
                : '💡 Upgrade ke Premium untuk mulai mencatat trade sungguhan dan semua data tersimpan aman di cloud.'}
            </div>

            {trialAvailable ? (
              <>
                <button
                  onClick={handleStartTrial}
                  disabled={trialBusy}
                  style={{
                    width: '100%', background: '#C9A84C', color: '#000',
                    border: 'none', borderRadius: 10, padding: '13px',
                    fontWeight: 700, fontSize: 14,
                    cursor: trialBusy ? 'not-allowed' : 'pointer',
                    opacity: trialBusy ? 0.7 : 1,
                    marginBottom: 10,
                  }}
                >
                  {trialBusy ? '⏳ Mengaktifkan trial...' : '🎁 Mulai Trial 2 Hari Gratis'}
                </button>
                <button
                  onClick={() => {
                    setShowDemoPopup(false);
                    window.location.href = `/upgrade?email=${encodeURIComponent(userEmail)}`;
                  }}
                  disabled={trialBusy}
                  style={{
                    width: '100%', background: 'transparent', color: '#C9A84C',
                    border: '1px solid #C9A84C66', borderRadius: 10, padding: '11px',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10,
                  }}
                >
                  💳 Upgrade Sekarang
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowDemoPopup(false);
                  window.location.href = `/upgrade?email=${encodeURIComponent(userEmail)}`;
                }}
                style={{
                  width: '100%', background: '#C9A84C', color: '#000',
                  border: 'none', borderRadius: 10, padding: '13px',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10,
                }}
              >
                💳 Upgrade Sekarang
              </button>
            )}

            <button
              onClick={() => setShowDemoPopup(false)}
              disabled={trialBusy}
              style={{
                background: 'transparent', color: '#555',
                border: 'none', cursor: 'pointer', fontSize: 13,
              }}
            >
              Lihat Demo Dulu
            </button>
          </div>
        </div>
      )}

      {expiredPopup && (splashHidden || popupFallback) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#111', border: '1px solid #C9A84C44',
            borderRadius: 20, padding: '36px 28px',
            maxWidth: 400, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
            <h2 style={{ color: '#C9A84C', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              {EXPIRED_COPY[expiredPopup].title}
            </h2>
            <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7, margin: '0 0 20px' }}>
              {EXPIRED_COPY[expiredPopup].body}
            </p>
            <div style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 12, color: '#666', lineHeight: 1.6,
            }}>
              💡 Paket Free dibatasi 50 trade, dan fitur Filter, Analisis Bulanan, AI &amp; Foto MT5 terkunci. Upgrade untuk membukanya lagi.
            </div>
            <button
              onClick={() => {
                setExpiredPopup(null);
                window.location.href = '/upgrade?email=' + encodeURIComponent(userEmail);
              }}
              style={{
                width: '100%', background: '#C9A84C', color: '#000',
                border: 'none', borderRadius: 10, padding: '13px',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10,
              }}
            >
              💳 Upgrade Sekarang
            </button>
            <button
              onClick={() => setExpiredPopup(null)}
              style={{
                background: 'transparent', color: '#555',
                border: 'none', cursor: 'pointer', fontSize: 13,
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <PaymentSuccessModal />

      <Topbar
        apiKeyActive={apiKeyActive}
        notifGranted={notifGranted}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenNotif={() => setNotifOpen(true)}
      />

      <div
        className={`main ${activePage === 'home' ? 'home-active' : ''}`}
        style={{ paddingTop: currentUser && (demoMode || isTrial) ? 44 : undefined }}
      >
        <PageHome active={activePage === 'home'} switchPage={switchPage} openApiKeyModal={() => setApiKeyOpen(true)} />
        <PageRisk active={activePage === 'risk'} />
        <PagePlan active={activePage === 'plan'} switchPage={switchPage} />
        <PageData active={activePage === 'data'} />

        {/* PageFilter — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageFilter active={activePage === 'filter'} />
          {activePage === 'filter' && !canFilter && currentUser && (
            <PlanLockOverlay feature="Filter Trading" userEmail={userEmail} />
          )}
        </div>

        {/* PageWeekly — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageWeekly active={activePage === 'weekly'} />
          {activePage === 'weekly' && !canFilter && currentUser && (
            <PlanLockOverlay feature="Analisis Mingguan" userEmail={userEmail} />
          )}
        </div>

        {/* PageMonthly — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageMonthly active={activePage === 'monthly'} />
          {activePage === 'monthly' && !canMonthly && currentUser && (
            <PlanLockOverlay feature="Analisis Bulanan" userEmail={userEmail} />
          )}
        </div>

        {/* PageNews (AI) — dikunci untuk free & basic */}
        <div style={{ position: 'relative' }}>
          <PageNews active={activePage === 'news'} onOpenApiKeyModal={() => setApiKeyOpen(true)} />
          {activePage === 'news' && !canAI && currentUser && (
            <PlanLockOverlay feature="Analisis AI & Berita" userEmail={userEmail} />
          )}
        </div>

        {/* PageGallery — dikunci untuk free & basic (sama seperti filter) */}
        <div style={{ position: 'relative' }}>
          <PageGallery active={activePage === 'gallery'} />
          {activePage === 'gallery' && !canFilter && currentUser && (
            <PlanLockOverlay feature="Gallery Foto Analisa" userEmail={userEmail} />
          )}
        </div>

        <PageProfile active={activePage === 'profile'} onOpenApiKey={() => setApiKeyOpen(true)} onOpenNotif={() => setNotifOpen(true)} />
      </div>

      <BottomNav
        apiKeyActive={apiKeyActive}
        notifGranted={notifGranted}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenNotif={() => setNotifOpen(true)}
      />
      <ConfirmModal />
      <Toast />

      {canPhotoMT5 ? (
        <ApiKeyModal
          isOpen={apiKeyOpen}
          onClose={() => setApiKeyOpen(false)}
          onSaved={handleApiKeySaved}
          onToast={handleToast}
        />
      ) : (
        apiKeyOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 150,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setApiKeyOpen(false)}
          >
            <div
              style={{
                background: '#111', border: '1px solid #333',
                borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <div style={{ color: '#C9A84C', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Fitur Pro & Elite
              </div>
              <div style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Analisis foto MT5 dan AI hanya tersedia untuk Paket Pro & Elite.
              </div>
              <button
                onClick={() => {
                  setApiKeyOpen(false);
                  window.location.href = `/upgrade?email=${encodeURIComponent(userEmail)}`;
                }}
                style={{
                  background: '#C9A84C', color: '#000', border: 'none',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 8,
                }}
              >
                Upgrade Sekarang →
              </button>
              <button
                onClick={() => setApiKeyOpen(false)}
                style={{
                  background: 'transparent', color: '#555',
                  border: 'none', cursor: 'pointer', fontSize: 13,
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        )
      )}

      <TradeBreakdown />
      <NotifModal
        isOpen={notifOpen}
        onClose={handleNotifClose}
        onToast={handleToast}
      />
    </>
  );
}
