// app/api/econ-calendar/route.ts
// Port dari api/econ-calendar.js (Vercel serverless) → Next.js App Router Route Handler
// Fetch ForexFactory calendar JSON server-side (bypass CORS)
// Logic identik dengan source asli — tidak ada perubahan perilaku

import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Endpoint identik source asli — JSON bukan XML
const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json?version=1';

// Currency mayor yang diizinkan — identik source asli
const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']);

export async function GET(_request: NextRequest) {
  try {
    const r = await fetch(FF_URL, {
      headers: {
        // Headers identik dengan source asli — agar tidak di-block
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.forexfactory.com/',
        'Origin': 'https://www.forexfactory.com',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) throw new Error('ForexFactory HTTP ' + r.status);

    const events = await r.json();

    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Empty response');
    }

    // Filter & normalisasi — identik source asli
    // PENTING: field dari ForexFactory namanya "country", BUKAN "currency"
    // (isinya kode mata uang seperti USD/EUR/GBP)
    const filtered = events
      .filter(
        (ev: Record<string, string>) =>
          ALLOWED_CURRENCIES.has(ev.country) &&
          (ev.impact === 'High' || ev.impact === 'Medium')
      )
      // Normalisasi field "currency" agar konsisten di frontend (resolveFlag, dll)
      .map((ev: Record<string, string>) => ({ ...ev, currency: ev.country }));

    // Cache 1 jam di CDN — identik source asli (s-maxage=3600)
    return NextResponse.json(
      {
        ok: true,
        source: 'forexfactory',
        fetched_at: new Date().toISOString(),
        events: filtered,
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

    // Error response identik source asli — tidak ada mock data fallback
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