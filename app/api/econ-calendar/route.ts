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

// Fetch history untuk satu event (max 5 bulan terakhir)
async function fetchEventHistory(title: string): Promise<{date:string;actual:string;forecast:string;previous:string}[]> {
  // ForexFactory tidak punya public history API — generate dari data minggu lalu
  // Gunakan endpoint yang benar: ff_calendar_history.json dengan parameter title
  const urls = [
    `https://nfs.faireconomy.media/ff_calendar_history.json?title=${encodeURIComponent(title)}`,
    `https://cdn-nfs.faireconomy.media/ff_calendar_history.json?title=${encodeURIComponent(title)}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { ...FETCH_HEADERS },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) continue;
      const raw = await r.json();

      // Format bisa array langsung atau {history: [...]}
      const history: Record<string,string>[] = Array.isArray(raw) ? raw : (raw?.history || raw?.data || []);
      if (!history.length) continue;

      // Ambil 5 entry terbaru, descending by date
      return history
        .slice(-6)   // ambil 6 terakhir
        .slice(0, 5) // max 5
        .reverse()
        .map((h) => ({
          date: h.date || h.Date || h.release_date || '',
          actual: h.actual || h.Actual || '—',
          forecast: h.forecast || h.Forecast || '—',
          previous: h.previous || h.Previous || h.prev || '—',
        }))
        .filter(h => h.date);
    } catch {
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

    // Fetch history untuk setiap event HIGH impact (max 8 event, parallel)
    const highEvents = filtered.filter((ev: Record<string,string>) => ev.impact === 'High').slice(0, 8);
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
