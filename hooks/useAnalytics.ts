// hooks/useAnalytics.ts
// Dipindah dari admin.html: loadAnalytics() (baris 683-753).
// Perhitungan per-user (win rate, pair favorit, dst) 100% sama persis.
// Rendering Chart.js dipindah ke masing-masing komponen chart (lihat
// components/admin/analytics/*), hook ini hanya urus fetch + kalkulasi data.
'use client';

import { useCallback } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { useAdminStore } from '@/store/useAdminStore';
import type { UserAnalytics } from '@/lib/types';

export function useAnalytics() {
  const setAllUserData = useAdminStore((s) => s.setAllUserData);
  const setAnalyticsLoaded = useAdminStore((s) => s.setAnalyticsLoaded);
  const showToast = useAdminStore((s) => s.showToast);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoaded(true);
    try {
      // admin.html baris 691-699
      const { data: profiles, error: profErr } = await _sbAdmin
        .from('profiles')
        .select('id,email,display_name,is_blocked,is_activated');
      if (profErr) throw profErr;

      const { data: trades, error: trErr } = await _sbAdmin
        .from('trades')
        .select('user_id,tanggal,pair,result,lot,pl_idr');
      if (trErr) throw trErr;

      const { data: dws, error: dwErr } = await _sbAdmin
        .from('deposit_withdrawals')
        .select('user_id,tanggal,amount_idr,type');
      if (dwErr) throw dwErr;

      // admin.html baris 701-732 — group & hitung per user
      const tradesByUser: Record<string, any[]> = {};
      (trades || []).forEach((t) => {
        if (!tradesByUser[t.user_id]) tradesByUser[t.user_id] = [];
        tradesByUser[t.user_id].push(t);
      });

      const dwByUser: Record<string, any[]> = {};
      (dws || []).forEach((d) => {
        if (!dwByUser[d.user_id]) dwByUser[d.user_id] = [];
        dwByUser[d.user_id].push(d);
      });

      const allUserData: UserAnalytics[] = (profiles || [])
        .map((p) => {
          const ut = tradesByUser[p.id] || [];
          const ud = dwByUser[p.id] || [];
          const wins = ut.filter((t) => t.result === 'Profit').length;
          const wr = ut.length ? Math.round((wins / ut.length) * 100) : 0;
          const sorted = [...ut].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
          const lastTrade = sorted[0]?.tanggal || null;
          const pairCount: Record<string, number> = {};
          ut.forEach((t) => {
            if (t.pair) pairCount[t.pair] = (pairCount[t.pair] || 0) + 1;
          });
          const favPair = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
          return {
            id: p.id,
            email: p.email || '—',
            name: p.display_name || '',
            is_blocked: p.is_blocked,
            is_activated: p.is_activated,
            trades: ut.length,
            wins,
            wr,
            lastTrade,
            favPair,
            dwCount: ud.length,
            allTrades: ut,
            allDws: ud,
          };
        })
        .sort((a, b) => b.trades - a.trades);

      setAllUserData(allUserData);
      return { allUserData, trades: trades || [], dws: dws || [] };
    } catch (err: any) {
      console.error('Analytics error:', err);
      showToast('❌ Gagal memuat analytics: ' + err.message, 'error');
      return null;
    }
  }, [setAllUserData, setAnalyticsLoaded, showToast]);

  return { loadAnalytics };
}
