// hooks/useNewsAI.ts
// v5 — fix infinite loop + return hasil AI yang benar
// Berdasarkan analisis Gemini: shallow copy items, return updatedItems, batasi 4 item

'use client';

import { useState, useCallback, useRef } from 'react';
import { _sb } from '@/lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: string;
  title: string;
  desc: string;
  source: string;
  time: string;
  url: string;
  category: 'forex' | 'gold' | 'crypto' | 'economic' | 'fed';
  impact: 'high' | 'medium' | 'low';
  emoji: string;
  pairs?: string[];
  analysis?: string;
  speculation?: string;
  scenario_bear?: string;
  scenario_bull?: string;
  headline?: string;
  thumbnail?: string;
  _isMock?: boolean;
  _aiFallback?: boolean;
}

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_PROVIDER         = 'jz_ai_provider';
const LS_GEMINI_KEY       = 'jz_gemini_key';
const LS_GEMINI_NEWS      = 'jz_gemini_news_key';
const LS_ANTHROPIC_KEY    = 'jz_anthropic_key';
const NEWS_ANALYSIS_CACHE = 'jz_news_analysis_local';

// ── Helpers ───────────────────────────────────────────────────────────────────
function hashTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(title.length, 80); i++) {
    h = ((h << 5) - h) + title.charCodeAt(i);
    h |= 0;
  }
  return 'nh_' + Math.abs(h).toString(36);
}

// Teks fallback yang menandakan analisis belum valid — jangan loop ulang
const FALLBACK_MARKERS = [
  'Tambahkan API key',
  'aistudio.google.com',
  'Pengaturan AI',
  'Rate limit',
  'Koneksi ke AI server',
  'Gagal memuat analisis',
];
function isValidAnalysis(text?: string): boolean {
  if (!text || text.length < 80) return false;
  return !FALLBACK_MARKERS.some(m => text.includes(m));
}

// ── Local cache ───────────────────────────────────────────────────────────────
function getLocalCache(): Record<string, { analysis: string; speculation: string; headline?: string; scenario_bear?: string; scenario_bull?: string; desc?: string }> {
  try { return JSON.parse(localStorage.getItem(NEWS_ANALYSIS_CACHE) || '{}'); }
  catch { return {}; }
}
function saveLocalCache(items: NewsItem[]) {
  try {
    const existing = getLocalCache();
    items.forEach(n => {
      if (isValidAnalysis(n.analysis)) {
        existing[hashTitle(n.title)] = {
          analysis: n.analysis!,
          speculation: n.speculation || '',
          headline: n.headline,
          scenario_bear: n.scenario_bear,
          scenario_bull: n.scenario_bull,
          desc: n.desc,
        };
      }
    });
    localStorage.setItem(NEWS_ANALYSIS_CACHE, JSON.stringify(existing));
  } catch { /* ignore */ }
}

// ── Supabase cache ────────────────────────────────────────────────────────────
async function getSupabaseCache(
  hashes: string[], userId: string,
): Promise<Record<string, { analysis: string; speculation: string }>> {
  try {
    const { data } = await _sb
      .from('news_analysis_cache')
      .select('title_hash, analysis, speculation')
      .in('title_hash', hashes)
      .eq('user_id', userId);
    const map: Record<string, { analysis: string; speculation: string }> = {};
    (data || []).forEach((r: { title_hash: string; analysis: string; speculation: string }) => {
      if (isValidAnalysis(r.analysis)) map[r.title_hash] = { analysis: r.analysis, speculation: r.speculation };
    });
    return map;
  } catch { return {}; }
}

async function saveSupabaseCache(items: NewsItem[], userId: string) {
  const validItems = items.filter(n => isValidAnalysis(n.analysis));
  if (!validItems.length) return;
  try {
    const rows = validItems.map(n => ({
      user_id: userId,
      title_hash: hashTitle(n.title),
      analysis: n.analysis,
      speculation: n.speculation || '',
      created_at: new Date().toISOString(),
    }));
    await _sb.from('news_analysis_cache').upsert(rows, { onConflict: 'user_id,title_hash', ignoreDuplicates: false });
  } catch (e) {
    console.warn('[Cache] Supabase save error:', (e as Error).message);
  }
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
    userId?: string,
  ): Promise<NewsItem[]> => {
    if (!newsItems?.length) return newsItems;

    // GUARD: jangan double-call
    if (analyzingRef.current) {
      console.warn('[AI] Sudah berjalan, skip.');
      return newsItems;
    }

    // PENTING: shallow copy semua item agar tidak mutate React state langsung
    // Ini yang mencegah infinite loop (Gemini insight #A)
    const updatedItems = newsItems.map(item => ({ ...item }));

    const readLS = (k: string) => typeof window !== 'undefined' ? localStorage.getItem(k) : null;
    const provider  = readLS(LS_PROVIDER)      || 'gemini';
    const geminiKey = readLS(LS_GEMINI_KEY)    || '';
    const claudeKey = readLS(LS_ANTHROPIC_KEY) || '';
    const geminiNewsKey = readLS(LS_GEMINI_NEWS) || geminiKey;

    // Filter yang belum punya analisis valid
    const impactRank: Record<string, number> = { high: 0, medium: 1, med: 1, low: 2 };
    const pendingAll = updatedItems
      .filter(n => !isValidAnalysis(n.analysis))
      .sort((a, b) => (impactRank[a.impact] ?? 3) - (impactRank[b.impact] ?? 3));

    // Max 4 item per batch — lebih hemat token, kurangi chance rate limit
    const needAnalysis = pendingAll.slice(0, 4);

    if (!needAnalysis.length) {
      console.log('[AI] Semua berita sudah punya analisis valid.');
      return updatedItems;
    }

    // Cek local cache dulu
    const localCache = getLocalCache();
    const stillNeedAfterLocal = needAnalysis.filter(n => {
      const h = hashTitle(n.title);
      if (localCache[h]) {
        Object.assign(n, localCache[h]);
        n._aiFallback = false;
        return false;
      }
      return true;
    });

    // Cek Supabase cache
    let stillNeed = stillNeedAfterLocal;
    if (userId && stillNeed.length) {
      try {
        const sbCache = await getSupabaseCache(stillNeed.map(n => hashTitle(n.title)), userId);
        stillNeed = stillNeed.filter(n => {
          const h = hashTitle(n.title);
          if (sbCache[h]) {
            Object.assign(n, sbCache[h]);
            n._aiFallback = false;
            return false;
          }
          return true;
        });
      } catch { /* skip */ }
    }

    if (!stillNeed.length) {
      console.log('[AI] Semua dari cache.');
      return updatedItems;
    }

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

    // Set loading
    analyzingRef.current = true;
    setAiLoading(true);
    const safetyTimer = setTimeout(() => {
      analyzingRef.current = false;
      setAiLoading(false);
    }, 40000);

    // ── Prompt naratif ────────────────────────────────────────────────────────
    const prompt = `Kamu adalah analis forex dan ekonomi makro senior Indonesia. Berikan analisis NARATIF mendalam: konteks berita, angka actual vs forecast, rantai dampak ke market, pair yang terdampak.

Panduan:
- CPI/Inflasi naik > forecast → Fed hawkish → USD menguat → XAUUSD↓ EURUSD↓ GBPUSD↓
- NFP tinggi > forecast → USD menguat → USDJPY↑ XAUUSD↓
- Suku bunga naik → mata uang negara tersebut menguat
- PMI > 50 = ekspansi → mata uang menguat; < 50 = kontraksi → melemah
- Jobless Claims naik → USD melemah → XAUUSD↑

Berita (${stillNeed.length} item):
${stillNeed.map((n, i) => `${i + 1}. [${(n.impact || 'MEDIUM').toUpperCase()}] ${n.title}${n.desc ? ' | ' + n.desc.slice(0, 150) : ''}`).join('\n')}

Balas HANYA JSON array valid, tanpa markdown:
[{"headline":"1 kalimat + emoji","analysis":"narasi 3-4 kalimat + pair terdampak","scenario_bear":"2 kalimat kondisi bearish","scenario_bull":"2 kalimat kondisi bullish","speculation":"bias 1 kalimat","desc":"ringkasan 1 kalimat"}]`;

    try {
      let txt = '';

      // ── Gemini via server-side proxy ──────────────────────────────────────
      if (provider === 'gemini' && geminiNewsKey) {
        console.log(`[AI] Mengirim ${stillNeed.length} berita ke /api/ai-proxy...`);
        const res = await fetch('/api/ai-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, apiKey: geminiNewsKey, maxTokens: 1200 }),
          signal: AbortSignal.timeout(40000),
        });
        const data = await res.json();
        console.log(`[AI] Proxy: ok=${data.ok}, model=${data.model || '?'}`);

        if (data.ok && data.text) {
          txt = data.text;
        } else {
          const errMsg = data.error || `HTTP ${res.status}`;
          stillNeed.forEach(n => {
            n.analysis = errMsg.length < 200 ? errMsg : 'Gagal memuat analisis AI.';
            n.speculation = 'Pantau pergerakan harga pada chart.';
            n._aiFallback = true;
          });
        }

      // ── Claude ────────────────────────────────────────────────────────────
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
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const d = await r.json();
          txt = d?.content?.[0]?.text || '';
        }
      }

      // ── Parse JSON response AI ────────────────────────────────────────────
      if (txt) {
        const clean = txt.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const arrMatch = clean.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed: {
            headline?: string; analysis?: string;
            scenario_bear?: string; scenario_bull?: string;
            speculation?: string; desc?: string;
          }[] = JSON.parse(arrMatch[0]);

          parsed.forEach((p, i) => {
            if (!stillNeed[i]) return;
            const n = stillNeed[i];
            if (p.headline)      n.headline      = p.headline;
            if (p.analysis)      n.analysis      = p.analysis;
            if (p.scenario_bear) n.scenario_bear = p.scenario_bear;
            if (p.scenario_bull) n.scenario_bull = p.scenario_bull;
            if (p.speculation)   n.speculation   = p.speculation;
            if (p.desc)          n.desc          = p.desc;
            n._aiFallback = !isValidAnalysis(n.analysis);
          });

          // Simpan ke cache
          const successItems = stillNeed.filter(n => !n._aiFallback);
          if (successItems.length) {
            saveLocalCache(successItems);
            if (userId) saveSupabaseCache(successItems, userId).catch(() => {});
            console.log(`[AI] ✅ Berhasil analisis ${successItems.length} berita, disimpan ke cache.`);
          }
        }
      }
    } catch (e) {
      console.warn('[AI] Error:', (e as Error).message);
      stillNeed.forEach(n => {
        if (!isValidAnalysis(n.analysis)) {
          n.analysis = 'Gagal memuat analisis AI. Coba refresh.';
          n.speculation = 'Pantau chart untuk konfirmasi sinyal.';
          n._aiFallback = true;
        }
      });
    } finally {
      clearTimeout(safetyTimer);
      analyzingRef.current = false;
      setAiLoading(false);
    }

    // PENTING: return updatedItems (bukan newsItems original!)
    // Ini fix utama — sebelumnya return newsItems yang belum ter-update
    return updatedItems;
  }, []);

  const clearCache = useCallback(async (userId?: string) => {
    localStorage.removeItem(NEWS_ANALYSIS_CACHE);
    if (userId) {
      try {
        await _sb.from('news_analysis_cache').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('[Cache] Clear error:', (e as Error).message);
      }
    }
  }, []);

  return { aiLoading, analyzeNews, clearCache };
}