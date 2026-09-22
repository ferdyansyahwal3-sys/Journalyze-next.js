// app/api/econ-calendar/route.ts
// Port dari api/econ-calendar.js (Vercel serverless) → Next.js App Router Route Handler
// Fetch ForexFactory calendar JSON server-side (bypass CORS)
// v2: tambah history data per event (5 releases terakhir)

import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json?version=1';
// Endpoint history ForexFactory — by event title
const FF_HISTORY_URL = 'https://nfs.faireconomy.media/ff_calendar_history.json?title=';

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']);

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.forexfactory.com/',
  'Origin': 'https://www.forexfactory.com',
  'Cache-Control': 'no-cache',
};

// Fetch history untuk satu event (max 6 bulan terakhir)
async function fetchEventHistory(title: string): Promise<{date:string;actual:string;forecast:string;previous:string}[]> {
  const urls = [
    `https://nfs.faireconomy.media/ff_calendar_history.json?title=${encodeURIComponent(title)}`,
    `https://cdn-nfs.faireconomy.media/ff_calendar_history.json?title=${encodeURIComponent(title)}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { ...FETCH_HEADERS },
        signal: AbortSignal.timeout(6000),
      });
      console.log(`[history] ${title} → ${r.status} from ${url.slice(0,50)}`);
      if (!r.ok) continue;

      const text = await r.text();
      console.log(`[history] Raw (first 200): ${text.slice(0, 200)}`);

      let raw: unknown;
      try { raw = JSON.parse(text); } catch { continue; }

      // Handle semua format response
      let arr: Record<string,string>[] = [];
      if (Array.isArray(raw)) {
        arr = raw as Record<string,string>[];
      } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string,unknown>;
        const candidate = obj.history || obj.data || obj.results || obj.releases;
        if (Array.isArray(candidate)) arr = candidate as Record<string,string>[];
      }

      console.log(`[history] Array length: ${arr.length} for "${title}"`);
      if (arr.length > 0) {
        console.log(`[history] Sample entry keys: ${Object.keys(arr[0]).join(',')}`);
        console.log(`[history] Sample entry: ${JSON.stringify(arr[0])}`);
      }
      if (!arr.length) continue;

      // Ambil 6 entry terbaru — sort descending by date dulu
      const sorted = [...arr].sort((a, b) => {
        const da = new Date(a.date || a.Date || a.release_date || 0).getTime();
        const db = new Date(b.date || b.Date || b.release_date || 0).getTime();
        return db - da; // descending: terbaru duluan
      });

      return sorted
        .slice(0, 6)
        .map(h => ({
          date:     h.date     || h.Date     || h.release_date || h.releaseDate || '',
          actual:   h.actual   || h.Actual   || h.actual_value || '—',
          forecast: h.forecast || h.Forecast || h.consensus    || h.estimate   || '—',
          previous: h.previous || h.Previous || h.prior        || h.prev       || h.revised || '—',
        }))
        .filter(h => h.date);
    } catch (e) {
      console.warn(`[history] Exception: ${(e as Error).message}`);
      continue;
    }
  }
  return [];
}

export async function GET(_request: NextRequest) {
  try {
    const r = await fetch(FF_URL, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) throw new Error('ForexFactory HTTP ' + r.status);

    const events = await r.json();

    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Empty response');
    }

    // Filter & normalisasi
    const filtered = events
      .filter(
        (ev: Record<string, string>) =>
          ALLOWED_CURRENCIES.has(ev.country) &&
          (ev.impact === 'High' || ev.impact === 'Medium')
      )
      .map((ev: Record<string, string>) => ({ ...ev, currency: ev.country }));

    // Fetch history untuk setiap event HIGH impact (max 12, parallel)
    const highEvents = filtered.filter((ev: Record<string,string>) => ev.impact === 'High').slice(0, 12);
    const historyResults = await Promise.allSettled(
      highEvents.map((ev: Record<string,string>) => fetchEventHistory(ev.title || ev.name || ''))
    );

    // Attach history ke event yang sesuai
    const titleHistoryMap: Record<string, {date:string;actual:string;forecast:string;previous:string}[]> = {};
    highEvents.forEach((ev: Record<string,string>, i: number) => {
      const res = historyResults[i];
      if (res.status === 'fulfilled' && res.value.length) {
        titleHistoryMap[ev.title || ev.name || ''] = res.value;
      }
    });

    const enriched = filtered.map((ev: Record<string,string>) => ({
      ...ev,
      history: titleHistoryMap[ev.title || ev.name || ''] || [],
    }));

    return NextResponse.json(
      {
        ok: true,
        source: 'forexfactory',
        fetched_at: new Date().toISOString(),
        events: enriched,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[econ-calendar] Error:', message);

    return NextResponse.json(
      { ok: false, error: message, events: [] },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}