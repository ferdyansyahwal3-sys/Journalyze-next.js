// hooks/useNewsAI.ts — v6
// Shared cache: analisis AI disimpan global di Supabase, semua user pakai bersama
// Flow: localStorage → Supabase shared → Gemini API → simpan shared

'use client';

import { useState, useCallback, useRef } from 'react';
import { _sb } from '@/lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: string; title: string; desc: string; source: string;
  time: string; url: string;
  category: 'forex' | 'gold' | 'crypto' | 'economic' | 'fed';
  impact: 'high' | 'medium' | 'low';
  emoji: string; pairs?: string[];
  analysis?: string; speculation?: string;
  scenario_bear?: string; scenario_bull?: string; headline?: string;
  thumbnail?: string; _isMock?: boolean; _aiFallback?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LS_PROVIDER      = 'jz_ai_provider';
const LS_GEMINI_KEY    = 'jz_gemini_key';
const LS_GEMINI_NEWS   = 'jz_gemini_news_key';
const LS_ANTHROPIC_KEY = 'jz_anthropic_key';
const LOCAL_CACHE_KEY  = 'jz_news_analysis_local';
const SHARED_TABLE     = 'news_analysis_shared';
const TTL_MS           = 12 * 60 * 60 * 1000; // 12 jam
const MAX_BATCH        = 8;                     // max berita per prompt
const GENERATING_TIMEOUT = 30 * 1000;          // 30 detik timeout flag generating

// ── Helpers ───────────────────────────────────────────────────────────────────
function hashTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(title.length, 80); i++) {
    h = ((h << 5) - h) + title.charCodeAt(i);
    h |= 0;
  }
  return 'nh_' + Math.abs(h).toString(36);
}

const FALLBACK_MARKERS = [
  'Tambahkan API key', 'aistudio.google.com', 'Pengaturan AI',
  'Rate limit', 'Koneksi ke AI', 'Gagal memuat',
];
function isValidAnalysis(text?: string): boolean {
  if (!text || text.length < 80) return false;
  return !FALLBACK_MARKERS.some(m => text.includes(m));
}

// ── Local cache (localStorage) — TTL 12 jam ───────────────────────────────────
type LocalEntry = {
  analysis: string; speculation: string; headline?: string;
  scenario_bear?: string; scenario_bull?: string; desc?: string;
  savedAt: number;
};

function getLocalEntry(hash: string): LocalEntry | null {
  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const e: LocalEntry = store[hash];
    if (!e || !isValidAnalysis(e.analysis)) return null;
    if (Date.now() - e.savedAt > TTL_MS) return null;
    return e;
  } catch { return null; }
}

function saveLocalEntries(items: NewsItem[]) {
  try {
    const store: Record<string, LocalEntry> = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const now = Date.now();
    // Prune expired dulu
    Object.keys(store).forEach(k => { if (now - store[k].savedAt > TTL_MS) delete store[k]; });
    items.forEach(n => {
      if (isValidAnalysis(n.analysis)) {
        store[hashTitle(n.title)] = {
          analysis: n.analysis!, speculation: n.speculation || '',
          headline: n.headline, scenario_bear: n.scenario_bear,
          scenario_bull: n.scenario_bull, desc: n.desc, savedAt: now,
        };
      }
    });
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

// ── Supabase shared cache ─────────────────────────────────────────────────────
type SharedEntry = {
  title_hash: string; analysis: string; speculation: string;
  headline: string; scenario_bear: string; scenario_bull: string;
  description: string; is_generating: boolean; expires_at: string;
};

async function getSharedCache(hashes: string[]): Promise<Record<string, SharedEntry>> {
  try {
    const now = new Date().toISOString();
    const { data } = await _sb
      .from(SHARED_TABLE)
      .select('title_hash,analysis,speculation,headline,scenario_bear,scenario_bull,description,is_generating,expires_at')
      .in('title_hash', hashes)
      .or(`expires_at.gt.${now},is_generating.eq.true`); // ambil yang masih valid ATAU sedang generate

    const map: Record<string, SharedEntry> = {};
    (data || []).forEach((r: SharedEntry) => { map[r.title_hash] = r; });
    return map;
  } catch { return {}; }
}

async function setGeneratingFlag(hashes: string[], titles: string[]) {
  try {
    const rows = hashes.map((h, i) => ({
      title_hash: h, title: (titles[i] || '').slice(0, 200),
      analysis: '', speculation: '', headline: '',
      scenario_bear: '', scenario_bull: '', description: '',
      is_generating: true,
      expires_at: new Date(Date.now() + GENERATING_TIMEOUT).toISOString(),
    }));
    await _sb.from(SHARED_TABLE).upsert(rows, { onConflict: 'title_hash', ignoreDuplicates: false });
  } catch { /* best effort */ }
}

async function saveSharedCache(items: NewsItem[]) {
  const valid = items.filter(n => isValidAnalysis(n.analysis));
  if (!valid.length) return;
  try {
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const rows = valid.map(n => ({
      title_hash: hashTitle(n.title),
      title: n.title.slice(0, 200),
      analysis: n.analysis || '',
      speculation: n.speculation || '',
      headline: n.headline || '',
      scenario_bear: n.scenario_bear || '',
      scenario_bull: n.scenario_bull || '',
      description: n.desc || '',
      source: n.source || '',
      impact: n.impact || 'medium',
      category: n.category || 'forex',
      is_generating: false,
      expires_at: expiresAt,
    }));
    await _sb.from(SHARED_TABLE).upsert(rows, { onConflict: 'title_hash', ignoreDuplicates: false });
    console.log(`[SharedCache] ✅ Simpan ${rows.length} analisis — berlaku sampai ${expiresAt}`);
  } catch (e) {
    console.warn('[SharedCache] Save error:', (e as Error).message);
  }
}

async function pruneSharedCache() {
  try {
    // Hapus yang expired DAN bukan sedang generating
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    await _sb.from(SHARED_TABLE).delete()
      .lt('expires_at', cutoff)
      .eq('is_generating', false);
  } catch { /* best effort */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export interface UseNewsAIReturn {
  aiLoading: boolean;
  analyzeNews: (items: NewsItem[], userId?: string) => Promise<NewsItem[]>;
  clearCache: (userId?: string) => Promise<void>;
}

export function useNewsAI(): UseNewsAIReturn {
  const [aiLoading, setAiLoading] = useState(false);
  const analyzingRef = useRef(false);

  const analyzeNews = useCallback(async (
    newsItems: NewsItem[],
    _userId?: string, // tidak dipakai lagi — cache sekarang shared
  ): Promise<NewsItem[]> => {
    if (!newsItems?.length) return newsItems;
    if (analyzingRef.current) { console.warn('[AI] Sudah berjalan, skip.'); return newsItems; }

    // Shallow copy — cegah mutasi React state langsung
    const updatedItems = newsItems.map(item => ({ ...item }));

    const readLS = (k: string) => typeof window !== 'undefined' ? localStorage.getItem(k) : null;
    const provider     = readLS(LS_PROVIDER)      || 'gemini';
    const geminiKey    = readLS(LS_GEMINI_KEY)    || '';
    const claudeKey    = readLS(LS_ANTHROPIC_KEY) || '';
    const geminiNewsKey = readLS(LS_GEMINI_NEWS)  || geminiKey;

    // Filter berita yang belum punya analisis valid
    const impactRank: Record<string, number> = { high: 0, medium: 1, med: 1, low: 2 };
    const pendingAll = updatedItems
      .filter(n => !isValidAnalysis(n.analysis))
      .sort((a, b) => (impactRank[a.impact] ?? 3) - (impactRank[b.impact] ?? 3));

    if (!pendingAll.length) { console.log('[AI] Semua sudah punya analisis.'); return updatedItems; }

    // ── Step 1: Cek local cache (localStorage) ───────────────────────────────
    const afterLocal = pendingAll.filter(n => {
      const cached = getLocalEntry(hashTitle(n.title));
      if (cached) { Object.assign(n, cached); n._aiFallback = false; return false; }
      return true;
    });

    if (!afterLocal.length) { console.log('[AI] Semua dari local cache.'); return updatedItems; }

    // ── Step 2: Cek Supabase shared cache ────────────────────────────────────
    let stillNeed = afterLocal;
    const hashes = afterLocal.map(n => hashTitle(n.title));

    try {
      // Prune background
      pruneSharedCache().catch(() => {});

      const sharedCache = await getSharedCache(hashes);
      const nowIso = new Date().toISOString();

      stillNeed = afterLocal.filter(n => {
        const h = hashTitle(n.title);
        const entry = sharedCache[h];
        if (!entry) return true; // tidak ada di cache → perlu generate

        // Sedang di-generate user lain → tampilkan placeholder sementara
        if (entry.is_generating && entry.expires_at > nowIso) {
          console.log(`[SharedCache] ⏳ "${n.title.slice(0, 40)}" sedang di-generate user lain`);
          n.analysis = 'Analisis sedang disiapkan oleh sistem...';
          n._aiFallback = true;
          return false;
        }

        // Ada di cache dan masih valid
        if (isValidAnalysis(entry.analysis)) {
          n.analysis     = entry.analysis;
          n.speculation  = entry.speculation;
          n.headline     = entry.headline;
          n.scenario_bear = entry.scenario_bear;
          n.scenario_bull = entry.scenario_bull;
          if (entry.description) n.desc = entry.description;
          n._aiFallback = false;
          console.log(`[SharedCache] ✅ Hit: "${n.title.slice(0, 40)}..."`);
          return false;
        }

        return true; // expired atau invalid → perlu generate ulang
      });
    } catch (e) {
      console.warn('[SharedCache] Read error:', (e as Error).message);
    }

    if (!stillNeed.length) { return updatedItems; }

    // Cek API key
    const apiKey = provider === 'gemini' ? geminiNewsKey : claudeKey;
    if (!apiKey) {
      stillNeed.forEach(n => {
        n.analysis = 'Tambahkan API key Gemini di menu Pengaturan untuk mendapatkan analisis AI.';
        n.speculation = 'Konfirmasi sinyal pada chart sebelum melakukan entry.';
        n._aiFallback = true;
      });
      return updatedItems;
    }

    // ── Step 3: Generate via AI ───────────────────────────────────────────────
    analyzingRef.current = true;
    setAiLoading(true);
    const safetyTimer = setTimeout(() => { analyzingRef.current = false; setAiLoading(false); }, 45000);

    // Tandai sebagai "sedang generating" di Supabase (lock untuk user lain)
    const needHashes  = stillNeed.map(n => hashTitle(n.title));
    const needTitles  = stillNeed.map(n => n.title);
    await setGeneratingFlag(needHashes, needTitles).catch(() => {});

    // Batch: max MAX_BATCH per prompt
    const batches: NewsItem[][] = [];
    for (let i = 0; i < stillNeed.length; i += MAX_BATCH) {
      batches.push(stillNeed.slice(i, i + MAX_BATCH));
    }

    try {
      for (const batch of batches) {
        const prompt = `Kamu adalah analis forex dan ekonomi makro senior Indonesia. Analisis NARATIF mendalam.

Panduan dampak:
- CPI/Inflasi naik > forecast → Fed hawkish → USD menguat → XAUUSD↓ EURUSD↓ GBPUSD↓
- NFP tinggi > forecast → USD menguat → USDJPY↑ XAUUSD↓
- Suku bunga naik → mata uang negara tersebut menguat
- PMI > 50 = ekspansi → menguat; PMI < 50 = kontraksi → melemah
- Jobless Claims naik → USD melemah → XAUUSD↑

Analisis ${batch.length} berita berikut:
${batch.map((n, i) => `${i + 1}. [${(n.impact||'MEDIUM').toUpperCase()}] ${n.title}${n.desc ? ' | ' + n.desc.slice(0, 120) : ''}`).join('\n')}

Balas HANYA JSON array dengan TEPAT ${batch.length} objek, tanpa markdown:
[{"headline":"1 kalimat + emoji","analysis":"narasi 3-4 kalimat mendalam + pair terdampak","scenario_bear":"2 kalimat bearish + pair","scenario_bull":"2 kalimat bullish + pair","speculation":"bias 1 kalimat","desc":"ringkasan 1 kalimat"}]`;

        let txt = '';

        if (provider === 'gemini' && geminiNewsKey) {
          console.log(`[AI] Kirim batch ${batch.length} berita ke /api/ai-proxy...`);
          const res = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              apiKey: geminiNewsKey, // server akan pakai env var GEMINI_API_KEY jika tersedia
              maxTokens: 2000,
            }),
            signal: AbortSignal.timeout(40000),
          });
          const data = await res.json();
          console.log(`[AI] Proxy: ok=${data.ok}, model=${data.model || '?'}`);
          if (data.ok && data.text) txt = data.text;
          else {
            batch.forEach(n => {
              n.analysis = data.error || 'Gagal memuat analisis AI.';
              n.speculation = 'Pantau pergerakan harga pada chart.';
              n._aiFallback = true;
            });
            continue;
          }
        } else if (provider === 'claude' && claudeKey) {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2000,
              messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(35000),
          });
          if (r.ok) { const d = await r.json(); txt = d?.content?.[0]?.text || ''; }
        }

        // ── Parse JSON response ─────────────────────────────────────────────
        if (txt) {
          try {
            const clean = txt.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const arrMatch = clean.match(/\[[\s\S]*\]/);
            if (arrMatch) {
              const parsed: {
                headline?: string; analysis?: string; scenario_bear?: string;
                scenario_bull?: string; speculation?: string; desc?: string;
              }[] = JSON.parse(arrMatch[0]);

              parsed.forEach((p, i) => {
                if (!batch[i]) return;
                const n = batch[i];
                if (p.headline)      n.headline      = p.headline;
                if (p.analysis)      n.analysis      = p.analysis;
                if (p.scenario_bear) n.scenario_bear = p.scenario_bear;
                if (p.scenario_bull) n.scenario_bull = p.scenario_bull;
                if (p.speculation)   n.speculation   = p.speculation;
                if (p.desc)          n.desc          = p.desc;
                n._aiFallback = !isValidAnalysis(n.analysis);
              });

              // Simpan ke shared cache + local cache
              const successItems = batch.filter(n => !n._aiFallback);
              if (successItems.length) {
                saveSharedCache(successItems).catch(() => {});
                saveLocalEntries(successItems);
                console.log(`[AI] ✅ ${successItems.length} analisis berhasil, disimpan ke shared cache`);
              }
            }
          } catch (parseErr) {
            console.warn('[AI] JSON parse error:', (parseErr as Error).message);
            batch.forEach(n => {
              if (!isValidAnalysis(n.analysis)) { n._aiFallback = true; }
            });
          }
        }
      }
    } catch (e) {
      console.warn('[AI] Error:', (e as Error).message);
    } finally {
      clearTimeout(safetyTimer);
      analyzingRef.current = false;
      setAiLoading(false);
    }

    return updatedItems;
  }, []);

  const clearCache = useCallback(async (_userId?: string) => {
    // Hapus local cache
    localStorage.removeItem(LOCAL_CACHE_KEY);
    // Hapus semua shared cache yang expired (bukan force delete semua)
    try {
      const cutoff = new Date(Date.now() - 1000).toISOString(); // semua yang sudah expire
      await _sb.from(SHARED_TABLE).delete().lt('expires_at', cutoff);
      console.log('[Cache] Shared cache cleared');
    } catch (e) {
      console.warn('[Cache] Clear error:', (e as Error).message);
    }
  }, []);

  return { aiLoading, analyzeNews, clearCache };
}