// hooks/useRates.ts
// Dipindah dari index.html: fetchRates() (baris 3971-4088), applyRates(),
// persistRatesToSupabase(). Hook ini di-mount di PageRisk dan juga dipakai
// ulang nanti oleh PageData (Phase 5) yang butuh kurs untuk format P/L.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { _sb } from '@/lib/supabaseClient';
import { applyRates, buildRatesTicker, RATES_CACHE_KEY, RATES_CACHE_TTL } from '@/lib/riskCalc';
import { useJournalStore } from '@/store/useJournalStore';

export interface TickerState {
  items: { p: string; r: string }[];
  timeLabel: string;
}

export function useRates() {
  const currentUser = useJournalStore((s) => s.currentUser);
  const [ticker, setTicker] = useState<TickerState>({ items: [], timeLabel: '' });

  const persistRatesToSupabase = useCallback(
    async (cache: Record<string, number>) => {
      // index.html baris 4143-4162
      try {
        if (!currentUser) return;
        const now = new Date().toISOString();
        await _sb.from('app_settings').upsert(
          {
            user_id: currentUser.id,
            usd_idr_rate: cache.USD_IDR || null,
            jpy_idr_rate: cache.JPY_IDR || null,
            eur_idr_rate: cache.EUR_IDR || null,
            gbp_idr_rate: cache.GBP_IDR || null,
            rates_updated_at: now,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        );
      } catch (e: any) {
        console.warn('[useRates] persistRatesToSupabase error:', e.message);
      }
    },
    [currentUser]
  );

  const fetchRates = useCallback(async () => {
    // index.html baris 3971-4090 — urutan: Supabase → localStorage → er-api → frankfurter → cache lama
    const applyAndSet = (cache: Record<string, number>, stale = false) => {
      applyRates(cache);
      setTicker(buildRatesTicker(cache, stale));
    };

    // 0. Cek Supabase dulu
    if (currentUser) {
      try {
        const { data: appRates } = await _sb
          .from('app_settings')
          .select('usd_idr_rate,jpy_idr_rate,eur_idr_rate,gbp_idr_rate,rates_updated_at')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (appRates?.usd_idr_rate && appRates?.rates_updated_at) {
          const sbTs = new Date(appRates.rates_updated_at).getTime();
          const localCached: Record<string, number> | null = JSON.parse(
            localStorage.getItem(RATES_CACHE_KEY) || 'null'
          );
          const localTs = localCached?.ts || 0;
          const localKurs = localCached?.USD_IDR || 0;
          const kursBeda = localKurs && Math.abs(localKurs - appRates.usd_idr_rate) > 50;
          if (sbTs > localTs || kursBeda) {
            const sbCache = {
              ts: sbTs,
              USD_IDR: appRates.usd_idr_rate,
              JPY_IDR: appRates.jpy_idr_rate || 108,
              EUR_IDR: appRates.eur_idr_rate || 17800,
              GBP_IDR: appRates.gbp_idr_rate || 20500,
            };
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(sbCache));
            applyAndSet(sbCache);
            if (Date.now() - sbTs < RATES_CACHE_TTL) return;
          }
        }
      } catch (e: any) {
        console.warn('[useRates] Supabase rates check error:', e.message);
      }
    }

    // 1. localStorage cache
    try {
      const cached: Record<string, number> | null = JSON.parse(
        localStorage.getItem(RATES_CACHE_KEY) || 'null'
      );
      if (cached?.ts && Date.now() - cached.ts < RATES_CACHE_TTL) {
        applyAndSet(cached);
        return;
      }
    } catch {}

    // 2. open.er-api.com
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (d.result !== 'success') throw new Error('API error');
      const cache = {
        ts: Date.now(),
        USD_IDR: d.rates.IDR || 16462,
        JPY_IDR: d.rates.IDR / d.rates.JPY,
        EUR_IDR: d.rates.IDR / d.rates.EUR,
        GBP_IDR: d.rates.IDR / d.rates.GBP,
      };
      localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache));
      applyAndSet(cache);
      persistRatesToSupabase(cache);
      return;
    } catch {}

    // 3. Frankfurter fallback
    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR,JPY,EUR,GBP');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const cache = {
        ts: Date.now(),
        USD_IDR: d.rates.IDR || 16462,
        JPY_IDR: d.rates.IDR / d.rates.JPY,
        EUR_IDR: d.rates.IDR / d.rates.EUR,
        GBP_IDR: d.rates.IDR / d.rates.GBP,
      };
      localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache));
      applyAndSet(cache);
      persistRatesToSupabase(cache);
      return;
    } catch {}

    // 4. Cache lama (stale)
    try {
      const old: Record<string, number> | null = JSON.parse(
        localStorage.getItem(RATES_CACHE_KEY) || 'null'
      );
      if (old) applyAndSet(old, true);
    } catch {}
  }, [currentUser, persistRatesToSupabase]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return { ticker, fetchRates };
}