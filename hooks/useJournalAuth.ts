// hooks/useJournalAuth.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { _sb } from '@/lib/supabaseClient';
import { useJournalStore } from '@/store/useJournalStore';

const EDGE_FN_URL = 'https://icouldevrvvtkxiincle.supabase.co/functions/v1/validate-license';

export function useJournalAuth() {
  const setCurrentUser        = useJournalStore((s) => s.setCurrentUser);
  const setAuthOverlayVisible = useJournalStore((s) => s.setAuthOverlayVisible);
  const setCloudLoading       = useJournalStore((s) => s.setCloudLoading);
  const setDisplayName        = useJournalStore((s) => s.setDisplayName);

  const [loginErr,    setLoginErr]    = useState('');
  const [regErr,      setRegErr]      = useState('');
  const [regOk,       setRegOk]       = useState('');
  const [loginBusy,   setLoginBusy]   = useState(false);
  const [regBusy,     setRegBusy]     = useState(false);
  const [blockedMsg,  setBlockedMsg]  = useState('');

  // ── onAuthSuccess — identik index.html baris 6905-6954 ──
  const onAuthSuccess = useCallback(
    async (user: NonNullable<Awaited<ReturnType<typeof _sb.auth.getUser>>['data']['user']>) => {
      try {
        // Ambil is_blocked DAN display_name sekaligus — index.html baris 7136
        const { data: prof, error: profErr } = await _sb
          .from('profiles')
          .select('is_blocked, display_name, notif_nickname')
          .eq('id', user.id)
          .maybeSingle();

        if (!profErr && prof?.is_blocked === true) {
          await _sb.auth.signOut();
          setCurrentUser(null);
          setAuthOverlayVisible(true);
          setBlockedMsg('⛔ Akun Anda telah dinonaktifkan oleh admin. Hubungi support untuk bantuan.');
          return;
        }

        // Simpan display_name ke store — index.html baris 7137-7140
        if (prof?.display_name) {
          setDisplayName(prof.display_name);
          // Auto-seed notif_nickname dari nama pertama jika belum ada
          if (prof.notif_nickname) {
            localStorage.setItem('jz_notif_nickname', prof.notif_nickname);
          } else {
            const firstName = prof.display_name.trim().split(/\s+/)[0];
            localStorage.setItem('jz_notif_nickname', firstName);
          }
        }
      } catch (e: any) {
        console.warn('[Journalyze] profiles check skip:', e.message);
      }

      setCurrentUser(user);
      setAuthOverlayVisible(false);
      setCloudLoading(true);
      setCloudLoading(false);
    },
    [setCurrentUser, setAuthOverlayVisible, setCloudLoading, setDisplayName]
  );

  // ── Restore sesi + listener ──
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
      const licKey  = licKeyRaw.trim().toUpperCase();
      const nameT   = name.trim();
      const emailT  = email.trim();
      const phoneT  = phone.trim();

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

  // ── Logout ──
  const doLogout = useCallback(async () => {
    await _sb.auth.signOut();
    setCurrentUser(null);
    setDisplayName('');
    setAuthOverlayVisible(true);
  }, [setCurrentUser, setDisplayName, setAuthOverlayVisible]);

  return {
    doLogin, doRegister, doLogout,
    loginErr, regErr, regOk,
    loginBusy, regBusy, blockedMsg,
    setLoginErr, setRegErr, setRegOk,
  };
}