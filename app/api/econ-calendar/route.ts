// app/api/econ-calendar/route.ts
// Kalender ekonomi minggu ini untuk PageNews.
//
// v3: baca dari tabel Supabase `econ_events` (diisi oleh /api/econ-sync) —
//     tidak ada lagi 12–24 request history ke feed eksternal per cache miss.
//     Kalau tabel belum terisi, fallback ke feed ForexFactory langsung (tanpa actual & history).

import { NextResponse } from 'next/server';
import { _sbAdmin } from '@/lib/supabaseClient';
import {
  CALENDAR_CURRENCIES,
  buildHistory,
  feedToRows,
  weekRangeWib,
  type HistoryRow,
  type SeriesRow,
} from '@/lib/econ';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json?version=1';
const FF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; +https://journalyze.my.id)',
  'Accept': 'application/json, */*',
};
const CACHE = 'public, s-maxage=60, stale-while-revalidate=120';

interface DbEvent {
  id: string;
  currency: string;
  title: string;
  title_key: string;
  impact: string;
  release_at: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

interface ClientEvent {
  title: string;
  name: string;
  country: string;
  currency: string;
  date: string;
  impact: 'High' | 'Medium';
  forecast: string;
  previous: string;
  actual: string;
  history: HistoryRow[];
}

function toClient(e: DbEvent, history: HistoryRow[]): ClientEvent {
  return {
    title: e.title,
    name: e.title,
    country: e.currency,
    currency: e.currency,
    date: e.release_at,
    impact: e.impact === 'high' ? 'High' : 'Medium',
    forecast: e.forecast ?? '',
    previous: e.previous ?? '',
    actual: e.actual ?? '',
    history,
  };
}

/** Ambil seluruh seri untuk event minggu ini dalam SATU query, lalu bangun history per event. */
async function loadHistories(events: DbEvent[]): Promise<Map<string, SeriesRow[]>> {
  const keys = Array.from(new Set(events.map(e => e.title_key)));
  const map = new Map<string, SeriesRow[]>();
  if (!keys.length) return map;
  const { data, error } = await _sbAdmin
    .from('econ_events')
    .select('currency,title_key,release_at,actual,forecast,previous')
    .in('title_key', keys)
    .in('currency', [...CALENDAR_CURRENCIES])
    .order('release_at', { ascending: true })
    .limit(3000);
  if (error) {
    console.warn('[econ-calendar] history query gagal:', error.message);
    return map;
  }
  for (const r of (data || []) as (SeriesRow & { currency: string; title_key: string })[]) {
    const k = `${r.currency}|${r.title_key}`;
    const arr = map.get(k);
    const row: SeriesRow = { release_at: r.release_at, actual: r.actual, forecast: r.forecast, previous: r.previous };
    if (arr) arr.push(row); else map.set(k, [row]);
  }
  return map;
}

export async function GET() {
  try {
    const { fromIso, toIso } = weekRangeWib();

    const { data, error } = await _sbAdmin
      .from('econ_events')
      .select('id,currency,title,title_key,impact,release_at,forecast,previous,actual')
      .gte('release_at', fromIso)
      .lt('release_at', toIso)
      .in('currency', [...CALENDAR_CURRENCIES])
      .in('impact', ['high', 'medium'])
      .order('release_at', { ascending: true });
    if (error) throw new Error('DB: ' + error.message);

    const rows = (data || []) as DbEvent[];

    if (rows.length) {
      const series = await loadHistories(rows);
      const events = rows.map(e =>
        toClient(e, buildHistory(series.get(`${e.currency}|${e.title_key}`) ?? [], e.release_at)),
      );
      return NextResponse.json(
        { ok: true, source: 'db', fetched_at: new Date().toISOString(), events },
        { headers: { 'Cache-Control': CACHE } },
      );
    }

    // ── Fallback: tabel belum terisi → feed langsung (tanpa actual & history) ──
    const r = await fetch(FF_URL, { headers: FF_HEADERS, signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!r.ok) throw new Error('ForexFactory HTTP ' + r.status);
    const feedRows = feedToRows(await r.json())
      .filter(x => (CALENDAR_CURRENCIES as readonly string[]).includes(x.currency) && (x.impact === 'high' || x.impact === 'medium'));
    if (!feedRows.length) throw new Error('Empty response');

    const events = feedRows.map(x =>
      toClient({ ...x, actual: null }, []),
    );
    return NextResponse.json(
      { ok: true, source: 'forexfactory-feed', fetched_at: new Date().toISOString(), events },
      { headers: { 'Cache-Control': CACHE } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[econ-calendar] Error:', message);
    return NextResponse.json({ ok: false, error: message, events: [] }, { status: 500 });
  }
}
