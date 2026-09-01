// hooks/useNewsAI.ts
// Port 1:1 dari fungsi generateAnalysis(), getNewsAnalysisCache(),
// saveNewsAnalysisCache(), hashTitle(), isAiFallbackText() di index.html
//
// Perubahan dari versi sebelumnya:
// - Prompt NARATIF: analisis 3-4 kalimat + sebut pair terdampak
// - Exponential backoff untuk error 503
// - Batch 6 item (naik dari 4)
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

// ── localStorage & Supabase keys ──────────────────────────────────────────────
const LS_PROVIDER           = 'jz_ai_provider';
const LS_GEMINI_KEY         = 'jz_gemini_key';
const LS_GEMINI_NEWS        = 'jz_gemini_news_key';
const LS_ANTHROPIC_KEY      = 'jz_anthropic_key';
const NEWS_ANALYSIS_CACHE_KEY = 'jz_news_analysis_local';

// ── Retry delays: 1.5s → 3s → 6s untuk error 503 ─────────────────────────────
const RETRY_DELAYS = [1500, 3000, 6000];

// ── Fallback text detection ───────────────────────────────────────────────────
const FALLBACK_TEXTS = [
  'Tambahkan API key',
  'Pantau pergerakan market terkait berita ini',
  'Pantau pergerakan market. (Rate limit',
  'Konfirmasi sinyal di chart sebelum entry',
  'Model AI tidak tersedia (404)',
  'Hubungi developer jika error ini terus muncul',
];
function isAiFallbackText(text?: string): boolean {
  return !text || text.length < 80 || FALLBACK_TEXTS.some(f => text.includes(f));
}

// ── hashTitle ─────────────────────────────────────────────────────────────────
function hashTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(title.length, 80); i++) {
    h = ((h << 5) - h) + title.charCodeAt(i);
    h |= 0;
  }
  return 'nh_' + Math.abs(h).toString(36);
}

// ── Fetch dengan retry otomatis untuk error 503 ───────────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  delays: number[] = RETRY_DELAYS,
): Promise<Response> {
  let lastErr: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, options);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < delays.length) {
        await new Promise(res => setTimeout(res, delays[attempt]));
        continue;
      }
      throw lastErr;
    }
    if (r.status === 503 && attempt < delays.length) {
      console.warn(`[useNewsAI] 503, retry ke-${attempt + 1} dalam ${delays[attempt]}ms`);
      await new Promise(res => setTimeout(res, delays[attempt]));
      continue;
    }
    return r;
  }
  throw lastErr;
}

// ── Cache: ambil dari Supabase → localStorage ─────────────────────────────────
async function getNewsAnalysisCache(
  titles: string[],
  userId?: string,
): Promise<Record<string, { analysis: string; speculation: string }>> {
  const wantedHashes = titles.map(t => hashTitle(t));

  if (userId) {
    try {
      const { data } = await _sb
        .from('news_analysis_cache')
        .select('title_hash, analysis, speculation')
        .in('title_hash', wantedHashes)
        .eq('user_id', userId);

      const map: Record<string, { analysis: string; speculation: string }> = {};
      (data || []).forEach((r: { title_hash: string; analysis: string; speculation: string }) => {
        if (!isAiFallbackText(r.analysis) && !isAiFallbackText(r.speculation)) {
          map[r.title_hash] = { analysis: r.analysis, speculation: r.speculation };
        }
      });
      return map;
    } catch (e) {
      console.warn('[News Cache] Supabase get error:', (e as Error).message);
    }
  }

  try {
    const local = JSON.parse(localStorage.getItem(NEWS_ANALYSIS_CACHE_KEY) || '{}');
    const filtered: Record<string, { analysis: string; speculation: string }> = {};
    wantedHashes.forEach(h => { if (local[h]) filtered[h] = local[h]; });
    return filtered;
  } catch { return {}; }
}

// ── Cache: simpan ke localStorage + Supabase ──────────────────────────────────
async function saveNewsAnalysisCache(items: NewsItem[], userId?: string) {
  const localCache: Record<string, { analysis: string; speculation: string }> = {};
  items.forEach(n => {
    if (n.analysis && n.speculation && !isAiFallbackText(n.analysis) && !isAiFallbackText(n.speculation)) {
      localCache[hashTitle(n.title)] = { analysis: n.analysis, speculation: n.speculation };
    }
  });

  try {
    const existing = JSON.parse(localStorage.getItem(NEWS_ANALYSIS_CACHE_KEY) || '{}');
    localStorage.setItem(NEWS_ANALYSIS_CACHE_KEY, JSON.stringify({ ...existing, ...localCache }));
  } catch { /* ignore */ }

  if (userId && Object.keys(localCache).length) {
    try {
      const rows = Object.entries(localCache).map(([hash, v]) => ({
        user_id: userId,
        title_hash: hash,
        analysis: v.analysis,
        speculation: v.speculation,
        created_at: new Date().toISOString(),
      }));
      await _sb
        .from('news_analysis_cache')
        .upsert(rows, { onConflict: 'user_id,title_hash', ignoreDuplicates: false });
    } catch (e) {
      console.warn('[News Cache] Supabase save error:', (e as Error).message);
    }
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
    // Guard anti double-call
    if (analyzingRef.current) {
      console.warn('[AI] analyzeNews sudah berjalan, skip');
      return newsItems;
    }
    analyzingRef.current = true;
    setAiLoading(true);
    // Safety: auto-reset jika stuck lebih dari 35 detik
    const safetyTimer = setTimeout(() => {
      if (analyzingRef.current) {
        console.warn('[AI] Safety reset — analyzingRef stuck');
        analyzingRef.current = false;
        setAiLoading(false);
      }
    }, 35000);

    const provider  = (typeof window !== 'undefined' ? localStorage.getItem(LS_PROVIDER)      : null) || 'gemini';
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem(LS_GEMINI_KEY)    : null) || '';
    const claudeKey = (typeof window !== 'undefined' ? localStorage.getItem(LS_ANTHROPIC_KEY) : null) || '';

    // Filter pending — prioritas high → medium, max 6 item
    const FALLBACK_MARKER = 'Tambahkan API key';
    const pendingAll = newsItems.filter(
      n => !n.analysis || n._aiFallback || (n.speculation && n.speculation.includes(FALLBACK_MARKER))
    );
    const impactRank: Record<string, number> = { high: 0, medium: 1, med: 1, low: 2 };
    pendingAll.sort((a, b) => (impactRank[a.impact] ?? 3) - (impactRank[b.impact] ?? 3));
    const needAnalysis = pendingAll.slice(0, 6);
    needAnalysis.forEach(n => { n.analysis = ''; n.speculation = ''; });

    if (!needAnalysis.length) {
      analyzingRef.current = false;
      setAiLoading(false);
      return newsItems;
    }

    // Cek cache dulu
    try {
      const cached = await getNewsAnalysisCache(needAnalysis.map(n => n.title), userId);
      const stillNeed: NewsItem[] = [];
      needAnalysis.forEach(n => {
        const h = hashTitle(n.title);
        if (cached[h]) {
          n.analysis   = cached[h].analysis;
          n.speculation = cached[h].speculation;
        } else {
          stillNeed.push(n);
        }
      });
      if (!stillNeed.length) {
        analyzingRef.current = false;
        setAiLoading(false);
        return newsItems;
      }
      needAnalysis.length = 0;
      stillNeed.forEach(n => needAnalysis.push(n));
    } catch (e) {
      console.warn('[News Cache] get error:', (e as Error).message);
    }

    // Cek API key
    const apiKey = provider === 'gemini' ? geminiKey : claudeKey;
    if (!apiKey) {
      needAnalysis.forEach(n => {
        if (!n.analysis)    n.analysis    = 'Berita ini berpotensi mempengaruhi pergerakan pasar. Pantau level support/resistance kunci.';
        if (!n.speculation) n.speculation = 'Tambahkan API key Gemini/Claude di Pengaturan untuk analisis & spekulasi otomatis.';
        n._aiFallback = true;
      });
      analyzingRef.current = false;
      setAiLoading(false);
      return newsItems;
    }

    // ── Prompt naratif — analisis mendalam + pair terdampak ──────────────────
    const prompt = `Kamu adalah analis forex dan ekonomi makro senior Indonesia. Tugasmu memberikan analisis NARATIF mendalam yang menjelaskan konteks berita, angka aktual vs ekspektasi, rantai dampak ke market, dan pair forex yang paling terdampak.

Panduan dampak indikator ke market:
- CPI/Inflasi naik di atas forecast → Fed makin hawkish → USD menguat → XAUUSD turun, EURUSD turun, GBPUSD turun
- NFP tinggi di atas forecast → ekonomi AS kuat → USD menguat → USDJPY naik, XAUUSD turun
- Suku bunga naik → mata uang negara tersebut menguat vs pair lawan
- GDP di atas ekspektasi → mata uang menguat
- PMI di atas 50 = ekspansi → mata uang menguat; di bawah 50 = kontraksi → melemah
- Jobless Claims naik → ekonomi lemah → USD melemah → XAUUSD naik
- PPI naik → leading indicator inflasi → USD cenderung menguat

Untuk setiap berita, tulis dalam gaya NARATIF (bukan bullet point):
- headline: 1 kalimat tajam + emoji rantai sebab-akibat, max 85 karakter
- analysis: narasi 3-4 kalimat — jelaskan apa beritanya, angka actual vs forecast vs previous jika ada, mengapa ini penting bagi trader, dan pair forex mana yang paling terdampak beserta arah geraknya (contoh: EURUSD berpotensi turun, XAUUSD tertekan, USDJPY menguat)
- scenario_bear: narasi 2 kalimat — kondisi spesifik pemicu bearish, sebutkan pair dan estimasi level target
- scenario_bull: narasi 2 kalimat — kondisi spesifik pemicu bullish, sebutkan pair dan estimasi level target
- speculation: 1 kalimat bias utama + alasan fundamental singkat, max 150 karakter
- desc: 1 kalimat ringkasan untuk trader pemula, max 100 karakter

Berita:
${needAnalysis.map((n, i) => (i + 1) + '. [' + (n.impact || 'MEDIUM').toUpperCase() + '] ' + n.title + (n.desc ? ' | Konteks: ' + n.desc.slice(0, 200) : '')).join('\n')}

Balas HANYA JSON array valid, tanpa markdown, tanpa komentar:
[{"headline":"...","analysis":"...","scenario_bear":"...","scenario_bull":"...","speculation":"...","desc":"..."}]`;

    try {
      let txt = '';

      // ── Gemini ───────────────────────────────────────────────────────────
      if (provider === 'gemini' && geminiKey) {
        const geminiNewsKey = (typeof window !== 'undefined'
          ? localStorage.getItem(LS_GEMINI_NEWS)
          : null) || geminiKey;

        const NEWS_MODEL = 'gemini-3.5-flash-lite';
        const buildOpts = (): RequestInit => ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1200, temperature: 0.4 },
          }),
          signal: AbortSignal.timeout(30000),
        });
        const buildUrl = (key: string) =>
          `https://generativelanguage.googleapis.com/v1beta/models/${NEWS_MODEL}:generateContent?key=${key}`;

        let r = await fetchWithRetry(buildUrl(geminiNewsKey), buildOpts());

        if (!r.ok && r.status === 429) {
          await new Promise(res => setTimeout(res, 3000));
          if (geminiNewsKey !== geminiKey) r = await fetchWithRetry(buildUrl(geminiKey), buildOpts());
          if (!r.ok && r.status === 429) {
            await new Promise(res => setTimeout(res, 5000));
            r = await fetchWithRetry(buildUrl(geminiNewsKey), buildOpts());
          }
        }

        if (r.ok) {
          const d = await r.json();
          txt = (d?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
        } else {
          const errBody = await r.text().catch(() => '');
          console.warn('[AI] Gemini error:', r.status, errBody.slice(0, 300));
          if (r.status === 429) {
            needAnalysis.forEach(n => {
              if (!n.analysis)    n.analysis    = 'Pantau pergerakan market. (Rate limit — auto-retry saat refresh)';
              if (!n.speculation) n.speculation = 'Cek chart untuk konfirmasi sinyal entry/exit.';
              n._aiFallback = true;
            });
          } else if (r.status === 404) {
            needAnalysis.forEach(n => {
              if (!n.analysis)    n.analysis    = 'Model AI tidak tersedia (404). Cek versi model di Pengaturan AI.';
              if (!n.speculation) n.speculation = 'Hubungi developer jika error ini terus muncul.';
              n._aiFallback = true;
            });
          } else {
            needAnalysis.forEach(n => {
              if (!n.analysis)    n.analysis    = 'Pantau pergerakan market terkait berita ini.';
              if (!n.speculation) n.speculation = 'Konfirmasi sinyal di chart sebelum entry.';
              n._aiFallback = true;
            });
          }
        }

      // ── Claude ───────────────────────────────────────────────────────────
      } else if (provider === 'claude' && claudeKey) {
        const r = await fetchWithRetry(
          'https://api.anthropic.com/v1/messages',
          {
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
          },
        );
        if (r.ok) {
          const d = await r.json();
          txt = d?.content?.[0]?.text || '';
        }
      }

      // ── Parse hasil AI ────────────────────────────────────────────────────
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
            if (needAnalysis[i]) {
              if (p.headline)      needAnalysis[i].headline      = p.headline;
              if (p.analysis)      needAnalysis[i].analysis      = p.analysis;
              if (p.scenario_bear) needAnalysis[i].scenario_bear = p.scenario_bear;
              if (p.scenario_bull) needAnalysis[i].scenario_bull = p.scenario_bull;
              if (p.speculation)   needAnalysis[i].speculation   = p.speculation;
              if (p.desc)          needAnalysis[i].desc          = p.desc;
              if (p.analysis && p.speculation) needAnalysis[i]._aiFallback = false;
            }
          });

          needAnalysis.forEach(n => { if (n._aiFallback !== false) n._aiFallback = true; });

          const realResults = needAnalysis.filter(n => n._aiFallback === false);
          if (realResults.length) saveNewsAnalysisCache(realResults, userId).catch(() => {});
        }
      }

    } catch (e) {
      console.warn('[AI] analyzeNews error:', (e as Error).message);
      needAnalysis.forEach(n => {
        if (!n.analysis)    n.analysis    = 'Pantau pergerakan market terkait berita ini.';
        if (!n.speculation) n.speculation = 'Konfirmasi sinyal di chart sebelum entry.';
        n._aiFallback = true;
      });
    } finally {
      clearTimeout(safetyTimer);
      analyzingRef.current = false;
      setAiLoading(false);
    }

    return newsItems;
  }, []);

  const clearCache = useCallback(async (userId?: string) => {
    localStorage.removeItem(NEWS_ANALYSIS_CACHE_KEY);
    if (userId) {
      try {
        await _sb.from('news_analysis_cache').delete().eq('user_id', userId);
        console.log('[News Cache] Supabase cache cleared');
      } catch (e) {
        console.warn('[News Cache] Clear error:', (e as Error).message);
      }
    }
  }, []);

  return { aiLoading, analyzeNews, clearCache };
}