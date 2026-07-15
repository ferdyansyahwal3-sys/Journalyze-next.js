// hooks/useJournalAuth.ts
// Dipindah dari index.html baris 6808-6954 (dalam window.addEventListener('load',...)).
// Pakai _sb yang sama dengan admin (URL & anon key-nya identik di aslinya —
// lihat lib/supabaseClient.ts), jadi tidak bikin instance Supabase client baru.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { _sb } from '@/lib/supabaseClient';
import { useJournalStore } from '@/store/useJournalStore';

// index.html baris 6846
const EDGE_FN_URL = 'https://icouldevrvvtkxiincle.supabase.co/functions/v1/validate-license';

export function useJournalAuth() {
  const setCurrentUser = useJournalStore((s) => s.setCurrentUser);
  const setAuthOverlayVisible = useJournalStore((s) => s.setAuthOverlayVisible);
  const setCloudLoading = useJournalStore((s) => s.setCloudLoading);

  const [loginErr, setLoginErr] = useState('');
  const [regErr, setRegErr] = useState('');
  const [regOk, setRegOk] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState('');

  // ── onAuthSuccess — index.html baris 6905-6954 ──
  const onAuthSuccess = useCallback(
    async (user: NonNullable<Awaited<ReturnType<typeof _sb.auth.getUser>>['data']['user']>) => {
      // Cek is_blocked SEBELUM apapun (baris 6906-6933)
      try {
        const { data: profile, error: profErr } = await _sb
          .from('profiles')
          .select('is_blocked')
          .eq('id', user.id)
          .maybeSingle();
        if (!profErr && profile?.is_blocked === true) {
          await _sb.auth.signOut();
          setCurrentUser(null);
          setAuthOverlayVisible(true);
          setBlockedMsg('⛔ Akun Anda telah dinonaktifkan oleh admin. Hubungi support untuk bantuan.');
          console.warn('[Journalyze] Login ditolak — akun diblokir admin');
          return;
        }
      } catch (blockCheckErr: any) {
        console.warn('[Journalyze] is_blocked check skip:', blockCheckErr.message);
      }

      // Akun aktif — lanjut (baris 6934-6953)
      setCurrentUser(user);
      setAuthOverlayVisible(false);
      setCloudLoading(true);
      // TODO Phase 4 (page-data): panggil loadCloudData() di sini setelah
      // hook trades/dwList (useTrades/useDepositWithdrawals) dibuat —
      // index.html baris 7114 dst. Untuk sekarang cloud data belum di-fetch.
      setCloudLoading(false);
      // TODO Phase 4+: fetchRates(), _setupRealtime(user.id)
    },
    [setCurrentUser, setAuthOverlayVisible, setCloudLoading]
  );

  // ── Restore sesi + listener — index.html baris 7478 ──
  useEffect(() => {
    _sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) onAuthSuccess(session.user);
    });
    const { data: sub } = _sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !useJournalStore.getState().currentUser) {
        onAuthSuccess(session.user);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Login — index.html baris 6831-6843 ──
  const doLogin = useCallback(
    async (email: string, pass: string) => {
      setLoginErr('');
      setBlockedMsg('');
      const emailT = email.trim();
      if (!emailT || !pass) {
        setLoginErr('Email dan password harus diisi');
        return;
      }
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

  // ── Register — index.html baris 6848-6881 ──
  const doRegister = useCallback(
    async (name: string, email: string, pass: string, phone: string, licKeyRaw: string) => {
      setRegErr('');
      setRegOk('');
      const licKey = licKeyRaw.trim().toUpperCase();
      const nameT = name.trim();
      const emailT = email.trim();
      const phoneT = phone.trim();

      if (!nameT || !emailT || !pass || !phoneT || !licKey) {
        setRegErr('Semua field harus diisi');
        return;
      }
      if (nameT.length < 2) {
        setRegErr('Nama panggilan minimal 2 karakter');
        return;
      }
      if (pass.length < 6) {
        setRegErr('Password minimal 6 karakter');
        return;
      }
      if (!/^(\+62|08)[0-9]{8,12}$/.test(phoneT)) {
        setRegErr('❌ Format no HP tidak valid (contoh: 08123456789)');
        return;
      }
      if (!/^JZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey)) {
        setRegErr('❌ Format license key tidak valid');
        return;
      }

      setRegBusy(true);
      try {
        const res = await fetch(EDGE_FN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: licKey, email: emailT, password: pass, phone: phoneT, displayName: nameT }),
        });
        const result = await res.json();
        if (!result.success) {
          const errMsg = result.error || 'Terjadi kesalahan. Coba lagi.';
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

  // ── Logout — index.html baris 6887-6895 ──
  const doLogout = useCallback(async () => {
    await _sb.auth.signOut();
    setCurrentUser(null);
    setAuthOverlayVisible(true);
    // TODO Phase 4: reset trades/dwList di store data begitu hook-nya ada
  }, [setCurrentUser, setAuthOverlayVisible]);

  return {
    doLogin,
    doRegister,
    doLogout,
    loginErr,
    regErr,
    regOk,
    loginBusy,
    regBusy,
    blockedMsg,
    setLoginErr,
    setRegErr,
    setRegOk,
  };
}