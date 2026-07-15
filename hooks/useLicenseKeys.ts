// hooks/useLicenseKeys.ts
// Dipindah dari admin.html: loadKeys(), applyFilter(), generateKey(),
// confirmAction() (bagian revoke/restore/block/unblock). Logic identik,
// hanya sumber/tujuan data pindah dari variabel global -> Zustand store.
'use client';

import { useCallback, useMemo } from 'react';
import { _sb, DELIVERY_BASE } from '@/lib/supabaseClient';
import { encodeDeliveryToken, genKeyString } from '@/lib/adminHelpers';
import { useAdminStore, PAGE_SIZE } from '@/store/useAdminStore';
import type { LicenseKey } from '@/lib/types';

export function useLicenseKeys() {
  const allKeys = useAdminStore((s) => s.allKeys);
  const setAllKeys = useAdminStore((s) => s.setAllKeys);
  const searchQuery = useAdminStore((s) => s.searchQuery);
  const statusFilter = useAdminStore((s) => s.statusFilter);
  const currentPage = useAdminStore((s) => s.currentPage);
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const showToast = useAdminStore((s) => s.showToast);
  const pendingAction = useAdminStore((s) => s.pendingAction);
  const setPendingAction = useAdminStore((s) => s.setPendingAction);

  const loadKeys = useCallback(async () => {
    // admin.html baris 468-499
    try {
      const { data: keys, error } = await _sb
        .from('license_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const usedByIds = (keys || []).filter((k) => k.used_by).map((k) => k.used_by);
      let emailMap: Record<string, { email: string; is_blocked: boolean }> = {};
      if (usedByIds.length) {
        const { data: profs } = await _sb
          .from('profiles')
          .select('id,email,is_blocked')
          .in('id', usedByIds);
        (profs || []).forEach((p) => {
          emailMap[p.id] = { email: p.email, is_blocked: p.is_blocked || false };
        });
      }

      const merged: LicenseKey[] = (keys || []).map((k) => ({
        ...k,
        profiles: k.used_by
          ? {
              email: emailMap[k.used_by]?.email || null,
              is_blocked: emailMap[k.used_by]?.is_blocked || false,
            }
          : null,
      }));
      setAllKeys(merged);
    } catch (err: any) {
      console.error('loadKeys error:', err);
      showToast('❌ Gagal memuat data: ' + err.message, 'error');
    }
  }, [setAllKeys, showToast]);

  // Setara applyFilter() — tapi dihitung reaktif (derived state), bukan imperatif
  const filteredKeys = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allKeys.filter((k) => {
      let ok = true;
      if (statusFilter === 'unused') ok = !k.is_used && !k.is_revoked;
      else if (statusFilter === 'used') ok = k.is_used && !k.is_revoked;
      else if (statusFilter === 'revoked') ok = k.is_revoked;
      const em = k.profiles?.email || '';
      return (
        ok &&
        (!q ||
          k.key?.toLowerCase().includes(q) ||
          em.toLowerCase().includes(q) ||
          (k.customer_name || '').toLowerCase().includes(q))
      );
    });
  }, [allKeys, searchQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      total: allKeys.length,
      used: allKeys.filter((k) => k.is_used && !k.is_revoked).length,
      unused: allKeys.filter((k) => !k.is_used && !k.is_revoked).length,
      revoked: allKeys.filter((k) => k.is_revoked).length,
    }),
    [allKeys]
  );

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / PAGE_SIZE));
  const pageKeys = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredKeys.slice(start, start + PAGE_SIZE);
  }, [filteredKeys, currentPage]);

  const goPage = useCallback(
    (p: number) => {
      if (p < 1 || p > totalPages) return;
      setCurrentPage(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [totalPages, setCurrentPage]
  );

  const generateKey = useCallback(
    async (name: string, qty: number) => {
      // admin.html baris 590-632
      try {
        const keys: string[] = [];
        for (let i = 0; i < qty; i++) {
          const key = genKeyString();
          const { error } = await _sb.from('license_keys').insert({
            key,
            is_used: false,
            is_revoked: false,
            customer_name: name || null,
            created_at: new Date().toISOString(),
          });
          if (error) throw error;
          keys.push(key);
        }
        showToast(`✅ ${qty} license key berhasil dibuat!`, 'success');
        await loadKeys();

        if (qty === 1) {
          const key = keys[0];
          const token = encodeDeliveryToken(key, name);
          const url = `${DELIVERY_BASE}/delivery.html?token=${token}&name=${encodeURIComponent(name)}`;
          return { mode: 'single' as const, key, url };
        }
        const bulk = keys.map((k) => {
          const token = encodeDeliveryToken(k, name);
          const url = `${DELIVERY_BASE}/delivery.html?token=${token}&name=${encodeURIComponent(name)}`;
          return { key: k, url };
        });
        return { mode: 'bulk' as const, bulk };
      } catch (err: any) {
        showToast('❌ Gagal: ' + err.message, 'error');
        return null;
      }
    },
    [loadKeys, showToast]
  );

  const confirmAction = useCallback(async () => {
    // admin.html baris 644-664
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    try {
      if ('email' in action) {
        // block / unblock
        const val = action.type === 'block' ? { is_blocked: true } : { is_blocked: false };
        const { error } = await _sb.from('profiles').update(val).eq('email', action.email);
        if (error) throw error;
        showToast(
          action.type === 'block'
            ? '🚫 Akun user berhasil diblokir'
            : '🔓 Akun user berhasil diaktifkan kembali',
          'success'
        );
        await loadKeys();
        return;
      }
      // revoke / restore
      const val = action.type === 'revoke' ? { is_revoked: true } : { is_revoked: false };
      const { error } = await _sb.from('license_keys').update(val).eq('key', action.key);
      if (error) throw error;
      showToast(
        action.type === 'revoke' ? '⛔ Akses key berhasil dicabut' : '♻️ Key berhasil di-restore',
        'success'
      );
      await loadKeys();
    } catch (err: any) {
      showToast('❌ Gagal: ' + err.message, 'error');
    }
  }, [pendingAction, setPendingAction, loadKeys, showToast]);

  return {
    filteredKeys,
    pageKeys,
    stats,
    totalPages,
    goPage,
    loadKeys,
    generateKey,
    confirmAction,
  };
}
