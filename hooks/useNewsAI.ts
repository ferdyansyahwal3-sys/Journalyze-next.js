// hooks/useNewsAI.ts
// Port 1:1 dari fungsi generateAnalysis(), getNewsAnalysisCache(),
// saveNewsAnalysisCache(), hashTitle(), isAiFallbackText() di index.html
// (baris 9128–9420).
//
// Penambahan dari versi sebelumnya:
// - Exponential backoff untuk error 503 (1.5s → 3s → 6s)
// - jz_gemini_news_key sebagai key khusus news (sudah ada, logika diperkuat)
// - Semua komentar dalam bahasa Indonesia
'use client';

import { useState, useCallback, useRef } from 'react';
import { _sb } from '@/lib/supabaseClient';

// ── Types (identik dengan PageNews.tsx) ───────────────────────────────────────
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

// ── Delay retry: 1.5s → 3s → 6s ──────────────────────────────────────────────
const RETRY_DELAYS = [1500, 3000, 6000];

// ── Fallback text detection — identik dengan isAiFallbackText ─────────────────
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

// ── hashTitle — identik dengan hashTitle() di index.html ─────────────────────
function hashTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(title.length, 80); i++) {
    h = ((h << 5) - h) + title.charCodeAt(i);
    h |= 0;
  }
  return 'nh_' + Math.abs(h).toString(36);
}

// ── Exponential backoff untuk error 503 ───────────────────────────────────────
// Retry otomatis maksimal 3x, hanya untuk error 503 (service unavailable)
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

    // Retry hanya untuk 503
    if (r.status === 503 && attempt < delays.length) {
      console.warn(`[useNewsAI] Error 503, retry ke-${attempt + 1} dalam ${delays[attempt]}ms...`);
      await new Promise(res => setTimeout(res, delays[attempt]));
      continue;
    }

    return r;
  }
  throw lastErr;
}

// ── getNewsAnalysisCache — identik dengan source ──────────────────────────────
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

  // Fallback localStorage
  try {
    const local = JSON.parse(localStorage.getItem(NEWS_ANALYSIS_CACHE_KEY) || '{}');
    const filtered: Record<string, { analysis: string; speculation: string }> = {};
    wantedHashes.forEach(h => { if (local[h]) filtered[h] = local[h]; });
    return filtered;
  } catch { return {}; }
}

// ── saveNewsAnalysisCache — identik dengan source ─────────────────────────────
async function saveNewsAnalysisCache(items: NewsItem[], userId?: string) {
  const localCache: Record<string, { analysis: string; speculation: string }> = {};
  items.forEach(n => {
    if (
      n.analysis && n.speculation &&
      !isAiFallbackText(n.analysis) && !isAiFallbackText(n.speculation)
    ) {
      localCache[hashTitle(n.title)] = { analysis: n.analysis, speculation: n.speculation };
    }
  });

  // Simpan localStorage selalu
  try {
    const existing = JSON.parse(localStorage.getItem(NEWS_ANALYSIS_CACHE_KEY) || '{}');
    localStorage.setItem(NEWS_ANALYSIS_CACHE_KEY, JSON.stringify({ ...existing, ...localCache }));
  } catch { /* ignore */ }

  // Simpan Supabase jika login
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

  // ── analyzeNews — port 1:1 dari generateAnalysis() + retry 503 ───────────
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

    const provider   = (typeof window !== 'undefined' ? localStorage.getItem(LS_PROVIDER)      : null) || 'gemini';
    const geminiKey  = (typeof window !== 'undefined' ? localStorage.getItem(LS_GEMINI_KEY)    : null) || '';
    const claudeKey  = (typeof window !== 'undefined' ? localStorage.getItem(LS_ANTHROPIC_KEY) : null) || '';

    // Filter pending — prioritas high → medium, max 4 item
    const FALLBACK_MARKER = 'Tambahkan API key';
    const pendingAll = newsItems.filter(
      n => !n.analysis || n._aiFallback || (n.speculation && n.speculation.includes(FALLBACK_MARKER))
    );
    const impactRank: Record<string, number> = { high: 0, medium: 1, med: 1, low: 2 };
    pendingAll.sort((a, b) => (impactRank[a.impact] ?? 3) - (impactRank[b.impact] ?? 3));
    const needAnalysis = pendingAll.slice(0, 4);
    needAnalysis.forEach(n => { n.analysis = ''; n.speculation = ''; });

    if (!needAnalysis.length) {
      analyzingRef.current = false;
      setAiLoading(false);
      return newsItems;
    }

    // ── Cek cache (Supabase → localStorage) ──────────────────────────────
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

    // ── Cek API key tersedia ──────────────────────────────────────────────
    const apiKey = provider === 'gemini' ? geminiKey : claudeKey;
    if (!apiKey) {
      needAnalysis.forEach(n => {
        if (!n.analysis)   n.analysis   = 'Berita ini berpotensi mempengaruhi pergerakan pasar. Pantau level support/resistance kunci.';
        if (!n.speculation) n.speculation = 'Tambahkan API key Gemini/Claude di Pengaturan untuk analisis & spekulasi otomatis.';
        n._aiFallback = true;
      });
      analyzingRef.current = false;
      setAiLoading(false);
      return newsItems;
    }

    // ── Prompt — identik verbatim dengan source index.html ───────────────
    const prompt = `Kamu adalah analis forex dan ekonomi makro senior Indonesia.\n\nKonteks indikator ekonomi:\n- CPI/Inflasi: naik = Fed hawkish = USD kuat = Gold turun\n- NFP: tinggi = ekonomi kuat = USD kuat = Gold turun\n- Suku Bunga: naik = mata uang menguat; turun = melemah\n- GDP: di atas ekspektasi = mata uang menguat\n- PMI: di atas 50 = ekspansi = mata uang menguat\n- Jobless Claims: tinggi = ekonomi lemah = mata uang melemah\n- PPI: naik = leading indicator inflasi naik\n\nUntuk setiap berita berikan:\n- headline: 1 kalimat tajam + emoji, format chain sebab-akibat, max 85 karakter\n- analysis: penjelasan mendalam: apa datanya, angka vs ekspektasi, rantai dampak ke market, max 450 karakter\n- scenario_bear: kondisi + pair + target level jika bearish, max 200 karakter\n- scenario_bull: kondisi + pair + target level jika bullish, max 200 karakter\n- speculation: bias utama 1 kalimat + alasan singkat, max 150 karakter\n- desc: ringkasan 1 kalimat untuk trader pemula, max 100 karakter\n\nBerita:\n${needAnalysis.map((n, i) => (i + 1) + '. [' + (n.impact || 'MEDIUM').toUpperCase() + '] ' + n.title + (n.desc ? ' | ' + n.desc.slice(0, 200) : '')).join('\n')}\n\nBalas HANYA JSON array valid, tanpa markdown:\n[{"headline":"...","analysis":"...","scenario_bear":"...","scenario_bull":"...","speculation":"...","desc":"..."}]`;

    try {
      let txt = '';

      // ── Gemini — dengan fetchWithRetry untuk 503 ──────────────────────
      if (provider === 'gemini' && geminiKey) {
        // Pakai news key jika ada, fallback ke main key
        const geminiNewsKey = (typeof window !== 'undefined'
          ? localStorage.getItem(LS_GEMINI_NEWS)
          : null) || geminiKey;

        const NEWS_MODEL = 'gemini-3.5-flash-lite';

        const buildGeminiOptions = (): RequestInit => ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
          }),
          signal: AbortSignal.timeout(30000),
        });

        const buildGeminiUrl = (key: string) =>
          `https://generativelanguage.googleapis.com/v1beta/models/${NEWS_MODEL}:generateContent?key=${key}`;

        // Coba news key dulu, dengan retry 503
        let r = await fetchWithRetry(buildGeminiUrl(geminiNewsKey), buildGeminiOptions());

        // Handling 429 — identik dengan source
        if (!r.ok) {
          if (r.status === 429) {
            await new Promise(res => setTimeout(res, 3000));
            // Coba main key jika news key berbeda
            if (geminiNewsKey !== geminiKey) {
              r = await fetchWithRetry(buildGeminiUrl(geminiKey), buildGeminiOptions());
            }
            if (!r.ok && r.status === 429) {
              await new Promise(res => setTimeout(res, 5000));
              r = await fetchWithRetry(buildGeminiUrl(geminiNewsKey), buildGeminiOptions());
            }
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
              if (!n.analysis)   n.analysis   = 'Pantau pergerakan market. (Rate limit — auto-retry saat refresh)';
              if (!n.speculation) n.speculation = 'Cek chart untuk konfirmasi sinyal entry/exit.';
              n._aiFallback = true;
            });
          } else if (r.status === 404) {
            needAnalysis.forEach(n => {
              if (!n.analysis)   n.analysis   = 'Model AI tidak tersedia (404). Cek versi model di Pengaturan AI.';
              if (!n.speculation) n.speculation = 'Hubungi developer jika error ini terus muncul.';
              n._aiFallback = true;
            });
          } else {
            needAnalysis.forEach(n => {
              if (!n.analysis)   n.analysis   = 'Pantau pergerakan market terkait berita ini.';
              if (!n.speculation) n.speculation = 'Konfirmasi sinyal di chart sebelum entry.';
              n._aiFallback = true;
            });
          }
        }

      // ── Claude — dengan fetchWithRetry untuk 503 ──────────────────────
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

      // ── Parse hasil AI — identik dengan source ────────────────────────
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
        if (!n.analysis)   n.analysis   = 'Pantau pergerakan market terkait berita ini.';
        if (!n.speculation) n.speculation = 'Konfirmasi sinyal di chart sebelum entry.';
        n._aiFallback = true;
      });
    } finally {
      analyzingRef.current = false;
      setAiLoading(false);
    }

    return newsItems;
  }, []);

  // ── clearCache — identik dengan clearNewsAnalysisCache() ─────────────────
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