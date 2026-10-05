// hooks/useRates.ts
// Mengisi `liveRates` (lib/riskCalc) yang dipakai halaman lain (PageData, dll).
//
// Sumber kurs, berurutan:
//   1. Gemini + Google Search (memakai API key Gemini yang sama dengan fitur OCR),
//      hasilnya dicek ulang terhadap kurs harian dari API gratis (anti salah baca).
//   2. open.er-api.com (update harian)
//   3. Frankfurter / ECB (update harian)
//
// Perilaku:
// - Kurs di-refresh tiap RATES_CACHE_TTL (3 jam), saat tab kembali dibuka, dan lewat interval.
// - Cache lokal & Supabase selalu DITIMPA (1 key localStorage, 1 baris app_settings per user),
//   jadi data kurs lama otomatis hilang dan tidak menumpuk.
// - Kurs yang sudah dikunci di tiap trade (trades.kurs) TIDAK disentuh hook ini.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { _sb } from '@/lib/supabaseClient';
import { applyRates, buildRatesTicker, RATES_CACHE_KEY, RATES_CACHE_TTL } from '@/lib/riskCalc';
import { useJournalStore } from '@/store/useJournalStore';

export interface TickerState {
  items: { p: string; r: string }[];
  timeLabel: string;
}

type RatesCache = Record<string, number>;

const FETCH_TIMEOUT_MS = 8000;
const GEMINI_TIMEOUT_MS = 25000;       // Gemini + search lebih lambat dari API biasa
const POLL_MS = RATES_CACHE_TTL / 6;   // cek tiap 30 menit; fetch jaringan hanya jika cache > TTL
const MAX_DEVIATION = 0.03;            // hasil Gemini ditolak jika melenceng > 3% dari kurs harian

// Kurs USD/IDR yang masuk akal. Di luar ini dianggap data rusak.
function isValid(c: RatesCache | null | undefined): c is RatesCache {
  return !!c && typeof c.USD_IDR === 'number' && c.USD_IDR > 5000 && c.USD_IDR < 50000;
}

function readLocal(): RatesCache | null {
  try {
    const c = JSON.parse(localStorage.getItem(RATES_CACHE_KEY) || 'null');
    return isValid(c) ? c : null;
  } catch {
    return null;
  }
}

async function getJson(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Sumber harian (tanpa API key) ────────────────────────────────────────────

async function fromErApi(): Promise<RatesCache | null> {
  try {
    const d = await getJson('https://open.er-api.com/v6/latest/USD');
    if (d.result !== 'success' || !d.rates?.IDR) return null;
    const cache: RatesCache = {
      ts: Date.now(),
      USD_IDR: d.rates.IDR,
      JPY_IDR: d.rates.JPY ? d.rates.IDR / d.rates.JPY : 108,
      EUR_IDR: d.rates.EUR ? d.rates.IDR / d.rates.EUR : 17800,
      GBP_IDR: d.rates.GBP ? d.rates.IDR / d.rates.GBP : 20500,
    };
    if (d.time_last_update_unix) cache.srcTs = d.time_last_update_unix * 1000;
    return isValid(cache) ? cache : null;
  } catch {
    return null;
  }
}

async function fromFrankfurter(): Promise<RatesCache | null> {
  try {
    const d = await getJson('https://api.frankfurter.app/latest?from=USD&to=IDR,JPY,EUR,GBP');
    if (!d.rates?.IDR) return null;
    const cache: RatesCache = {
      ts: Date.now(),
      USD_IDR: d.rates.IDR,
      JPY_IDR: d.rates.JPY ? d.rates.IDR / d.rates.JPY : 108,
      EUR_IDR: d.rates.EUR ? d.rates.IDR / d.rates.EUR : 17800,
      GBP_IDR: d.rates.GBP ? d.rates.IDR / d.rates.GBP : 20500,
    };
    return isValid(cache) ? cache : null;
  } catch {
    return null;
  }
}

// ── Sumber utama: Gemini + Google Search ─────────────────────────────────────

const RATES_PROMPT = `Cari kurs mata uang TERBARU hari ini di Google (Google Finance / hasil pencarian kurs).
Berikan berapa Rupiah Indonesia (IDR) untuk:
- 1 USD
- 1 EUR
- 1 GBP
- 1 JPY (SATU yen, bukan 100 yen)

Jawab HANYA JSON satu baris, tanpa markdown, tanpa penjelasan, angka desimal pakai titik, tanpa pemisah ribuan.
Contoh format: {"USD_IDR":17950.5,"EUR_IDR":20318.2,"GBP_IDR":23791.0,"JPY_IDR":113.49}`;

// `baseline` = kurs harian dari API gratis, dipakai sebagai pagar pengaman.
async function fromGeminiGoogle(baseline: RatesCache | null): Promise<RatesCache | null> {
  try {
    const key = localStorage.getItem('jz_gemini_key') || '';
    if (!key) return null;

    const d = await getJson(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: RATES_PROMPT }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 2048 },
        }),
      },
      GEMINI_TIMEOUT_MS
    );

    const txt: string = (d?.candidates?.[0]?.content?.parts || [])
      .map((p: { text?: string }) => p.text || '')
      .join('')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    const m = txt.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Record<string, unknown>;

    const keys = ['USD_IDR', 'EUR_IDR', 'GBP_IDR', 'JPY_IDR'] as const;
    const out: RatesCache = { ts: Date.now() };
    for (const k of keys) {
      const v = Number(j[k]);
      const base = baseline?.[k];
      if (!isFinite(v) || v <= 0) {
        // Nilai tidak terbaca: pakai kurs harian kalau ada, kalau tidak ada batalkan semua.
        if (base) { out[k] = base; continue; }
        return null;
      }
      // Pagar pengaman: tolak angka yang melenceng jauh dari kurs harian (salah baca / halusinasi).
      if (base && Math.abs(v - base) / base > MAX_DEVIATION) { out[k] = base; continue; }
      out[k] = v;
    }

    // Tanpa baseline, cukup cek kewajaran antar mata uang.
    if (!baseline) {
      const eurUsd = out.EUR_IDR / out.USD_IDR;
      const gbpUsd = out.GBP_IDR / out.USD_IDR;
      if (eurUsd < 0.8 || eurUsd > 1.5 || gbpUsd < 1 || gbpUsd > 1.8) return null;
      if (out.JPY_IDR < 30 || out.JPY_IDR > 400) return null;
    }
    return isValid(out) ? out : null;
  } catch {
    return null;
  }
}

export function useRates() {
  const currentUser = useJournalStore((s) => s.currentUser);
  const [ticker, setTicker] = useState<TickerState>({ items: [], timeLabel: '' });
  const inFlight = useRef(false);

  // Upsert onConflict user_id → selalu menimpa 1 baris milik user (data kurs lama hilang).
  const persistRatesToSupabase = useCallback(
    async (cache: RatesCache) => {
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

  // force = true → abaikan cache, langsung ambil dari sumber.
  const fetchRates = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const applyAndSet = (cache: RatesCache, stale = false) => {
          applyRates(cache);
          setTicker(buildRatesTicker(cache, stale));
        };

        // 1. Kandidat paling baru dari localStorage & Supabase (sinkron antar device).
        let best = readLocal();
        if (currentUser) {
          try {
            const { data: row } = await _sb
              .from('app_settings')
              .select('usd_idr_rate,jpy_idr_rate,eur_idr_rate,gbp_idr_rate,rates_updated_at')
              .eq('user_id', currentUser.id)
              .maybeSingle();
            if (row?.usd_idr_rate && row?.rates_updated_at) {
              const sbCache: RatesCache = {
                ts: new Date(row.rates_updated_at).getTime(),
                USD_IDR: Number(row.usd_idr_rate),
                JPY_IDR: Number(row.jpy_idr_rate) || 108,
                EUR_IDR: Number(row.eur_idr_rate) || 17800,
                GBP_IDR: Number(row.gbp_idr_rate) || 20500,
              };
              if (isValid(sbCache) && (!best || sbCache.ts > best.ts)) {
                best = sbCache;
                localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(sbCache));
              }
            }
          } catch (e: any) {
            console.warn('[useRates] Supabase rates check error:', e.message);
          }
        }

        // Tampilkan dulu yang ada supaya UI tidak kosong.
        if (best) applyAndSet(best);

        // Masih segar (< 3 jam) → selesai.
        if (!force && best && Date.now() - best.ts < RATES_CACHE_TTL) return;

        // 2. Kurs harian (pagar pengaman + fallback), lalu coba Gemini + Google Search.
        const daily = (await fromErApi()) || (await fromFrankfurter());
        const fresh = (await fromGeminiGoogle(daily)) || daily;

        if (fresh) {
          localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(fresh)); // timpa cache lama
          applyAndSet(fresh);
          persistRatesToSupabase(fresh); // timpa baris lama
          return;
        }

        // 3. Semua gagal → pakai yang ada, ditandai offline.
        if (best) applyAndSet(best, true);
      } finally {
        inFlight.current = false;
      }
    },
    [currentUser, persistRatesToSupabase]
  );

  // Fetch awal + saat user berubah.
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Cek ulang berkala dan saat tab kembali aktif (fetch jaringan tetap hanya jika cache > TTL).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRates();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(() => fetchRates(), POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [fetchRates]);

  const refreshNow = useCallback(() => fetchRates(true), [fetchRates]);

  return { ticker, fetchRates, refreshNow };
}
