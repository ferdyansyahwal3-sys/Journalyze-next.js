// hooks/usePageNews.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Shared types (inline — tidak import dari route handlers) ──────────────────
export interface EconEvent {
  id: string;
  date: string;
  time: string;
  currency: string;
  impact: 'low' | 'medium' | 'high' | 'holiday';
  event: string;
  actual: string;
  forecast: string;
  previous: string;
  detail?: string;
}

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category: string;
  author: string;
  thumbnail: string;
  source: string;
}

export type ImpactFilter = 'all' | 'high' | 'medium' | 'low';
export type CalendarWeek = 'this' | 'next';

export interface AISummary {
  loading: boolean;
  text: string;
  error: string;
  generatedAt: string;
}

export interface UsePageNewsReturn {
  calEvents: EconEvent[];
  calLoading: boolean;
  calError: string;
  calWeek: CalendarWeek;
  impactFilter: ImpactFilter;
  currencyFilter: string;
  setCalWeek: (w: CalendarWeek) => void;
  setImpactFilter: (f: ImpactFilter) => void;
  setCurrencyFilter: (c: string) => void;
  filteredEvents: EconEvent[];
  availableCurrencies: string[];
  newsItems: RSSItem[];
  newsLoading: boolean;
  newsError: string;
  newsPage: number;
  setNewsPage: (p: number) => void;
  pagedNews: RSSItem[];
  NEWS_PER_PAGE: number;
  aiSummary: AISummary;
  generateAISummary: () => void;
  refreshAll: () => void;
}

const NEWS_PER_PAGE = 6;
const SUMMARY_CACHE_KEY = 'jz_news_ai_summary';
const SUMMARY_CACHE_TTL = 4 * 60 * 60 * 1000;

export function usePageNews(): UsePageNewsReturn {
  const [calEvents, setCalEvents] = useState<EconEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
  const [calWeek, setCalWeek] = useState<CalendarWeek>('this');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  const [newsItems, setNewsItems] = useState<RSSItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [newsPage, setNewsPage] = useState(1);

  const [aiSummary, setAiSummary] = useState<AISummary>({
    loading: false, text: '', error: '', generatedAt: '',
  });

  const calAbortRef = useRef<AbortController | null>(null);
  const newsAbortRef = useRef<AbortController | null>(null);

  const fetchCalendar = useCallback(async (week: CalendarWeek) => {
    if (calAbortRef.current) calAbortRef.current.abort();
    calAbortRef.current = new AbortController();
    setCalLoading(true);
    setCalError('');
    try {
      const res = await fetch(`/api/econ-calendar?week=${week}`, { signal: calAbortRef.current.signal });
      const data = await res.json();
      if (data.warning) setCalError(`⚠ ${data.warning}`);
      setCalEvents(data.events ?? []);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setCalError('Gagal memuat kalender ekonomi');
    } finally {
      setCalLoading(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    if (newsAbortRef.current) newsAbortRef.current.abort();
    newsAbortRef.current = new AbortController();
    setNewsLoading(true);
    setNewsError('');
    try {
      const res = await fetch('/api/rss-proxy?multi=true', { signal: newsAbortRef.current.signal });
      const data = await res.json();
      if (data.error && (!data.items || data.items.length === 0)) {
        setNewsError(data.error);
      } else {
        setNewsItems(data.items ?? []);
        setNewsPage(1);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNewsError('Gagal memuat berita forex');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const generateAISummary = useCallback(async () => {
    try {
      const cached = localStorage.getItem(SUMMARY_CACHE_KEY);
      if (cached) {
        const { text, generatedAt } = JSON.parse(cached);
        if (Date.now() - new Date(generatedAt).getTime() < SUMMARY_CACHE_TTL) {
          setAiSummary({ loading: false, text, error: '', generatedAt });
          return;
        }
      }
    } catch { /* ignore */ }

    setAiSummary(prev => ({ ...prev, loading: true, error: '' }));

    const highImpactEvents = calEvents
      .filter(e => e.impact === 'high').slice(0, 8)
      .map(e => `${e.currency} — ${e.event} (${e.date} ${e.time}) [Forecast: ${e.forecast || 'N/A'}, Prev: ${e.previous || 'N/A'}]`)
      .join('\n');

    const topHeadlines = newsItems.slice(0, 8).map(n => `• ${n.title} [${n.source}]`).join('\n');

    const prompt = `Kamu adalah analis pasar forex profesional yang memberikan briefing singkat kepada prop trader. 
Berdasarkan data berikut, buat KESIMPULAN & SPEKULASI MARKET minggu ini dalam Bahasa Indonesia.

HIGH IMPACT EVENTS MINGGU INI:
${highImpactEvents || 'Tidak ada data kalender tersedia'}

HEADLINE BERITA TERKINI:
${topHeadlines || 'Tidak ada berita tersedia'}

Tulis dalam format:
1. **Ringkasan Sentimen Market** (2-3 kalimat)
2. **Pair yang Perlu Diwaspadai** (bullet point, max 4 pair)
3. **Spekulasi Arah Market** (2-3 kalimat, jelas sebutkan uncertainty)
4. **Tips Trading Minggu Ini** (1-2 kalimat konkret)

Gunakan bahasa yang jelas, profesional, dan to-the-point. Sertakan disclaimer singkat bahwa ini bukan saran investasi.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = (errData as { error?: { message?: string } })?.error?.message ?? `API error ${res.status}`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      const text = (data.content?.[0]?.text as string) ?? '';
      const generatedAt = new Date().toISOString();

      try { localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ text, generatedAt })); } catch { /* ignore */ }

      setAiSummary({ loading: false, text, error: '', generatedAt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAiSummary(prev => ({ ...prev, loading: false, error: `Gagal generate summary: ${msg}` }));
    }
  }, [calEvents, newsItems]);

  useEffect(() => { fetchCalendar(calWeek); }, [calWeek, fetchCalendar]);
  useEffect(() => { fetchNews(); }, [fetchNews]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(SUMMARY_CACHE_KEY);
      if (cached) {
        const { text, generatedAt } = JSON.parse(cached);
        if (Date.now() - new Date(generatedAt).getTime() < SUMMARY_CACHE_TTL) {
          setAiSummary({ loading: false, text, error: '', generatedAt });
        }
      }
    } catch { /* ignore */ }
  }, []);

  const availableCurrencies = Array.from(new Set(calEvents.map(e => e.currency).filter(Boolean))).sort();

  const filteredEvents = calEvents.filter(e => {
    if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
    if (currencyFilter !== 'all' && e.currency !== currencyFilter) return false;
    return true;
  });

  const pagedNews = newsItems.slice((newsPage - 1) * NEWS_PER_PAGE, newsPage * NEWS_PER_PAGE);

  const refreshAll = useCallback(() => {
    fetchCalendar(calWeek);
    fetchNews();
  }, [calWeek, fetchCalendar, fetchNews]);

  return {
    calEvents, calLoading, calError, calWeek, impactFilter, currencyFilter,
    setCalWeek, setImpactFilter, setCurrencyFilter, filteredEvents, availableCurrencies,
    newsItems, newsLoading, newsError, newsPage, setNewsPage, pagedNews, NEWS_PER_PAGE,
    aiSummary, generateAISummary, refreshAll,
  };
}