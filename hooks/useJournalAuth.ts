// hooks/useJournalAuth.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { _sb } from '@/lib/supabaseClient';
import { useJournalStore, type UserPlan } from '@/store/useJournalStore';

const EDGE_FN_URL = 'https://icouldevrvvtkxiincle.supabase.co/functions/v1/validate-license';

export function useJournalAuth() {
  const setCurrentUser        = useJournalStore((s) => s.setCurrentUser);
  const setAuthOverlayVisible = useJournalStore((s) => s.setAuthOverlayVisible);
  const setCloudLoading       = useJournalStore((s) => s.setCloudLoading);
  const setDisplayName        = useJournalStore((s) => s.setDisplayName);
  const setPlan               = useJournalStore((s) => s.setPlan);

  const [loginErr,   setLoginErr]   = useState('');
  const [regErr,     setRegErr]     = useState('');
  const [regOk,      setRegOk]      = useState('');
  const [loginBusy,  setLoginBusy]  = useState(false);
  const [regBusy,    setRegBusy]    = useState(false);
  const [blockedMsg, setBlockedMsg] = useState('');

  const searchParams = useSearchParams();

  // ── Core: fetch profil terbaru dari DB dan resolve plan ──
  const resolveProfileAndPlan = useCallback(
    async (userId: string) => {
      const { data: prof, error: profErr } = await _sb
        .from('profiles')
        .select('is_blocked, display_name, notif_nickname, plan, plan_type, admin_verified')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) {
        console.error('[Journalyze] Failed to fetch profile:', profErr.message);
        setPlan('free');
        return null;
      }

      return prof;
    },
    [setPlan]
  );

  // ── onAuthSuccess: dipanggil saat login, restore session, atau refresh ──
  const onAuthSuccess = useCallback(
    async (user: NonNullable<Awaited<ReturnType<typeof _sb.auth.getUser>>['data']['user']>) => {
      try {
        const prof = await resolveProfileAndPlan(user.id);

        if (!prof) {
          setCurrentUser(user);
          setAuthOverlayVisible(false);
          return;
        }

        // Cek blokir
        if (prof.is_blocked === true) {
          await _sb.auth.signOut();
          setCurrentUser(null);
          setAuthOverlayVisible(true);
          setBlockedMsg('⛔ Akun Anda telah dinonaktifkan oleh admin. Hubungi support untuk bantuan.');
          return;
        }

        // Simpan display_name
        if (prof.display_name) {
          setDisplayName(prof.display_name);
          const nickname = prof.notif_nickname || prof.display_name.trim().split(/\s+/)[0];
          localStorage.setItem('jz_notif_nickname', nickname);
        }

        // ── Resolve plan dari admin_verified sebagai gate ──
        const isAdminVerified = prof.admin_verified === true;
        let resolvedPlan: UserPlan = 'free';

        if (isAdminVerified) {
          const planType   = (prof.plan_type as string | null | undefined) ?? null;
          const validPlans: UserPlan[] = ['free', 'basic', 'pro', 'elite'];

          if (planType && validPlans.includes(planType as UserPlan)) {
            resolvedPlan = planType as UserPlan;
          } else {
            resolvedPlan = 'basic';
            console.warn('[Journalyze] admin_verified=true but plan_type is null, defaulting to basic');
          }
        } else {
          resolvedPlan = 'free';
          if (prof.plan === 'premium') {
            console.info('[Journalyze] plan=premium tapi admin_verified=false → override ke free');
          }
        }

        console.log('[Journalyze] Plan resolved:', resolvedPlan, '| admin_verified:', isAdminVerified);
        setPlan(resolvedPlan);

      } catch (e: any) {
        console.warn('[Journalyze] profiles check skip:', e.message);
        setPlan('free');
      }

      setCurrentUser(user);
      setAuthOverlayVisible(false);
      setCloudLoading(true);
      setCloudLoading(false);
    },
    [resolveProfileAndPlan, setCurrentUser, setAuthOverlayVisible, setCloudLoading, setDisplayName, setPlan]
  );

  // ── refreshPlan: fetch ulang profil tanpa logout/login ulang ──
  // Dipanggil setelah balik dari Midtrans (?payment=success)
  const refreshPlan = useCallback(async () => {
    console.log('[Journalyze] refreshPlan triggered — re-fetching profile from DB...');
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) {
      console.warn('[Journalyze] refreshPlan: no active session');
      return;
    }
    await onAuthSuccess(user);
  }, [onAuthSuccess]);

  // ── Restore sesi saat mount ──
  useEffect(() => {
    _sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) onAuthSuccess(session.user);
    });

    const { data: sub } = _sb.auth.onAuthStateChange((_event, session) => {
      // FIX: hapus kondisi !currentUser — biar selalu re-fetch saat auth berubah
      if (session?.user) {
        onAuthSuccess(session.user);
      } else {
        setCurrentUser(null);
        setPlan('free');
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── FIX UTAMA: Deteksi ?payment=success → refresh plan otomatis ──
  // Skenario: user bayar Midtrans → redirect ke /journal?payment=success
  // Saat itu session masih aktif tapi plan di store masih 'free'
  // → refreshPlan() fetch ulang dari DB yang sudah diupdate webhook
  useEffect(() => {
    const paymentStatus = searchParams?.get('payment');

    if (paymentStatus === 'success') {
      console.log('[Journalyze] Detected ?payment=success — refreshing plan...');

      // Delay kecil untuk pastikan webhook Midtrans sudah selesai update DB
      // Webhook biasanya selesai dalam <3 detik setelah user redirect
      const timer = setTimeout(async () => {
        await refreshPlan();

        // Bersihkan query param dari URL tanpa reload halaman
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
      }, 2000); // 2 detik buffer

      return () => clearTimeout(timer);
    }
  }, [searchParams, refreshPlan]);

  // ── Login ──
  const doLogin = useCallback(
    async (email: string, pass: string) => {
      setLoginErr('');
      setBlockedMsg('');
      const emailT = email.trim();
      if (!emailT || !pass) { setLoginErr('Email dan password harus diisi'); return; }
      setLoginBusy(true);
      const { data, error } = await _sb.auth.signInWithPassword({ email: emailT, password: pass });
      if (error) {
        setLoginErr(error.message.includes('Invalid') ? 'Email atau password salah' : error.message);
        setLoginBusy(false);
        return;
      }
      await onAuthSuccess(data.user);
      setLoginBusy(false);
    },
    [onAuthSuccess]
  );

  // ── Register ──
  const doRegister = useCallback(
    async (name: string, email: string, pass: string, phone: string, licKeyRaw: string) => {
      setRegErr('');
      setRegOk('');
      const licKey = licKeyRaw.trim().toUpperCase();
      const nameT  = name.trim();
      const emailT = email.trim();
      const phoneT = phone.trim();

      if (!nameT || !emailT || !pass || !phoneT || !licKey) { setRegErr('Semua field harus diisi'); return; }
      if (nameT.length < 2)   { setRegErr('Nama panggilan minimal 2 karakter'); return; }
      if (pass.length < 6)    { setRegErr('Password minimal 6 karakter'); return; }
      if (!/^(\+62|08)[0-9]{8,12}$/.test(phoneT)) { setRegErr('❌ Format no HP tidak valid (contoh: 08123456789)'); return; }
      if (!/^JZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey)) { setRegErr('❌ Format license key tidak valid'); return; }

      setRegBusy(true);
      try {
        const res = await fetch(EDGE_FN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseKey:  licKey,
            email:       emailT,
            password:    pass,
            phone:       phoneT,
            displayName: nameT,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          const errMsg   = result.error || 'Terjadi kesalahan. Coba lagi.';
          const isRevoked = errMsg.toLowerCase().includes('dicabut') || errMsg.toLowerCase().includes('revoked');
          setRegErr((isRevoked ? '🚫 ' : '❌ ') + errMsg);
          setRegBusy(false);
          return false;
        }
        setRegOk('✅ Akun berhasil dibuat! Silakan masuk.');
        setRegBusy(false);
        return true;
      } catch {
        setRegErr('❌ Gagal terhubung ke server. Periksa koneksi internet.');
        setRegBusy(false);
        return false;
      }
    },
    []
  );

  // ── Logout ──
  const doLogout = useCallback(async () => {
    await _sb.auth.signOut();
    setCurrentUser(null);
    setDisplayName('');
    setPlan('free');
    setAuthOverlayVisible(true);
  }, [setCurrentUser, setDisplayName, setPlan, setAuthOverlayVisible]);

  return {
    doLogin, doRegister, doLogout, refreshPlan,
    loginErr, regErr, regOk,
    loginBusy, regBusy, blockedMsg,
    setLoginErr, setRegErr, setRegOk,
  };
}