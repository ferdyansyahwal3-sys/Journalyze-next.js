// hooks/useAdminAuth.ts
// Dipindah dari admin.html: initAdmin(), checkAdminAccess(), doLogin(), doLogout()
// Logic sama persis — hanya update DOM (getElementById) diganti jadi setState.
'use client';

import { useEffect, useCallback } from 'react';
import { _sb, ALLOWED_ADMIN_EMAIL } from '@/lib/supabaseClient';
import { useAdminStore } from '@/store/useAdminStore';
import type { User } from '@supabase/supabase-js';

export function useAdminAuth() {
  const setAuthStatus = useAdminStore((s) => s.setAuthStatus);
  const setAdminLabel = useAdminStore((s) => s.setAdminLabel);
  const setLoginError = useAdminStore((s) => s.setLoginError);

  const checkAdminAccess = useCallback(
    async (user: User) => {
      // admin.html baris 393-415: cek kolom is_admin di tabel profiles
      const { data, error } = await _sb
        .from('profiles')
        .select('is_admin, display_name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data?.is_admin) {
        await _sb.auth.signOut();
        setLoginError('❌ Akun ini tidak memiliki akses admin.');
        setAuthStatus('loggedOut');
        return;
      }

      setAdminLabel(data.display_name || data.email || user.email || 'OWNER');
      setAuthStatus('loggedIn');
    },
    [setAdminLabel, setAuthStatus, setLoginError]
  );

  const initAdmin = useCallback(async () => {
    // admin.html baris 386-391
    const {
      data: { session },
    } = await _sb.auth.getSession();
    if (session) {
      await checkAdminAccess(session.user);
    } else {
      setAuthStatus('loggedOut');
    }
  }, [checkAdminAccess, setAuthStatus]);

  useEffect(() => {
    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doLogin = useCallback(
    async (email: string, pass: string) => {
      // admin.html baris 435-458
      setLoginError('');
      const emailLower = email.trim().toLowerCase();
      if (!emailLower || !pass) {
        setLoginError('❌ Email dan password wajib diisi.');
        return;
      }
      if (emailLower !== ALLOWED_ADMIN_EMAIL) {
        setLoginError('❌ Email ini tidak memiliki akses admin.');
        return;
      }
      const { data, error } = await _sb.auth.signInWithPassword({
        email: emailLower,
        password: pass,
      });
      if (error) {
        setLoginError('❌ ' + error.message);
        return;
      }
      await checkAdminAccess(data.user);
    },
    [checkAdminAccess, setLoginError]
  );

  const doLogout = useCallback(async () => {
    // admin.html baris 460-464
    await _sb.auth.signOut();
    sessionStorage.clear();
    location.reload();
  }, []);

  return { doLogin, doLogout };
}
