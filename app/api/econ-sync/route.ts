// app/api/econ-sync/route.ts
// Sinkronisasi kalender ekonomi → tabel Supabase `econ_events`.
//
//   1. Jadwal  : feed ForexFactory (nfs.faireconomy.media) — gratis, hanya forecast & previous.
//   2. Actual  : opsional, dari Finnhub kalau env FINNHUB_API_KEY diisi.
//                Pencocokan KONSERVATIF — kalau ragu, actual dibiarkan kosong.
//
// Dipanggil terjadwal (Make.com / Vercel Cron) dengan header:
//   Authorization: Bearer <CRON_SECRET>
//
// Query:
//   ?dry=1    → tidak menulis apa pun, hanya laporan
//   ?debug=1  → sertakan sampel respons provider + daftar event yang tidak cocok
//   ?force=1  → abaikan jeda minimum 30 menit untuk fetch feed ForexFactory

import { NextRequest, NextResponse } from 'next/server';
import { _sbAdmin } from '@/lib/supabaseClient';
import {
  feedToRows,
  matchProviderActuals,
  formatProviderValue,
  parseEconValue,
  scalesPlausible,
  type EconRow,
  type MatchFeedEvent,
  type ProviderEvent,
} from '@/lib/econ';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json?version=1';
const FF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; +https://journalyze.my.id)',
  'Accept': 'application/json, */*',
};
const FEED_MIN_INTERVAL_MS = 30 * 60 * 1000;   // jangan terlalu sering menembak feed (rate limit per IP)
const ACTUAL_LOOKBACK_MS = 3 * 24 * 3600 * 1000; // cari actual untuk event 3 hari terakhir
const CHUNK = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const dry = sp.get('dry') === '1';
  const debug = sp.get('debug') === '1';
  const force = sp.get('force') === '1';
  const db = _sbAdmin;

  const report: Record<string, unknown> = { ok: true, dry };

  try {
    // ── 1. Jadwal dari feed ForexFactory ─────────────────────────────────────
    const { data: lastRow } = await db
      .from('econ_events')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1);
    const lastMs = lastRow?.[0]?.fetched_at ? new Date(lastRow[0].fetched_at).getTime() : 0;
    const shouldFetchFeed = force || Date.now() - lastMs > FEED_MIN_INTERVAL_MS;

    if (shouldFetchFeed) {
      const r = await fetch(FF_URL, { headers: FF_HEADERS, signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: 'Feed ForexFactory HTTP ' + r.status }, { status: 502 });
      }
      const rows: EconRow[] = feedToRows(await r.json());
      if (!rows.length) {
        return NextResponse.json({ ok: false, error: 'Feed kosong / format berubah' }, { status: 502 });
      }
      report.schedule = { fetched: true, events: rows.length };

      if (!dry) {
        const nowIso = new Date().toISOString();
        for (const part of chunk(rows, CHUNK)) {
          const { error } = await db
            .from('econ_events')
            .upsert(part.map(x => ({ ...x, fetched_at: nowIso })), { onConflict: 'id' });
          if (error) throw new Error('Upsert gagal: ' + error.message);
        }

        // Hapus event yang dijadwal ulang / hilang dari feed (hanya yang belum punya actual).
        const times = rows.map(x => x.release_at).sort();
        const { data: existing, error: exErr } = await db
          .from('econ_events')
          .select('id,actual,actual_source')
          .gte('release_at', times[0])
          .lte('release_at', times[times.length - 1]);
        if (exErr) throw new Error('Baca existing gagal: ' + exErr.message);
        const keep = new Set(rows.map(x => x.id));
        const stale = (existing || [])
          .filter((x: { id: string; actual: string | null; actual_source: string | null }) =>
            !keep.has(x.id) && !x.actual && !x.actual_source)
          .map((x: { id: string }) => x.id);
        for (const part of chunk(stale, 100)) {
          await db.from('econ_events').delete().in('id', part);
        }
        (report.schedule as Record<string, unknown>).removed_stale = stale.length;
      }
    } else {
      report.schedule = { fetched: false, reason: 'masih dalam jeda 30 menit (pakai ?force=1 untuk memaksa)' };
    }

    // ── 2. Actual dari provider (opsional) ───────────────────────────────────
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!finnhubKey) {
      report.actuals = { enabled: false, reason: 'FINNHUB_API_KEY belum diisi' };
      return NextResponse.json(report);
    }

    const nowMs = Date.now();
    const { data: cands, error: cErr } = await db
      .from('econ_events')
      .select('id,currency,title,release_at,forecast,previous')
      .gte('release_at', new Date(nowMs - ACTUAL_LOOKBACK_MS).toISOString())
      .lte('release_at', new Date(nowMs).toISOString())
      .is('actual', null)
      .in('impact', ['high', 'medium'])
      .order('release_at', { ascending: true });
    if (cErr) throw new Error('Baca kandidat gagal: ' + cErr.message);

    const candidates = (cands || []) as MatchFeedEvent[];
    if (!candidates.length) {
      report.actuals = { enabled: true, candidates: 0 };
      return NextResponse.json(report);
    }

    const from = ymd(new Date(candidates[0].release_at).getTime());
    const to = ymd(nowMs + 24 * 3600 * 1000);
    let provider: ProviderEvent[] = [];
    let providerRaw: unknown = null;
    try {
      const pr = await fetch(
        `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`,
        { signal: AbortSignal.timeout(10000), cache: 'no-store' },
      );
      providerRaw = await pr.json().catch(() => null);
      if (!pr.ok) {
        report.actuals = { enabled: true, candidates: candidates.length, provider_status: pr.status, provider_error: (providerRaw as { error?: string } | null)?.error ?? 'HTTP ' + pr.status };
        return NextResponse.json(report);
      }
    } catch (e) {
      report.actuals = { enabled: true, candidates: candidates.length, provider_error: e instanceof Error ? e.name : 'fetch error' };
      return NextResponse.json(report);
    }

    const pj = providerRaw as { economicCalendar?: ProviderEvent[] } | ProviderEvent[] | null;
    provider = Array.isArray(pj) ? pj : (pj?.economicCalendar ?? []);

    const { matches, unmatched } = matchProviderActuals(candidates, provider);
    const byId = new Map(candidates.map(c => [c.id, c]));

    let written = 0;
    const skipped: { id: string; title: string; reason: string }[] = [];
    const preview: { feed: string; provider: string; score: number; dtMin: number; actual: string | null }[] = [];

    for (const m of matches) {
      const actualStr = formatProviderValue(m.provider.actual, m.provider.unit);
      const fe = byId.get(m.feedId);
      if (!actualStr || !fe) {
        skipped.push({ id: m.feedId, title: m.feedTitle, reason: 'belum ada actual di provider' });
        continue;
      }
      const a = parseEconValue(actualStr);
      const f = parseEconValue(fe.forecast);
      if (a !== null && f !== null && !scalesPlausible(a, f)) {
        skipped.push({ id: m.feedId, title: m.feedTitle, reason: 'skala actual vs forecast tidak cocok' });
        continue;
      }
      preview.push({ feed: m.feedTitle, provider: m.providerEvent, score: m.score, dtMin: m.dtMin, actual: actualStr });
      if (dry) continue;
      const { error } = await db
        .from('econ_events')
        .update({ actual: actualStr, actual_source: 'finnhub', actual_at: new Date().toISOString() })
        .eq('id', m.feedId);
      if (!error) written++;
    }

    report.actuals = {
      enabled: true,
      candidates: candidates.length,
      provider_events: provider.length,
      matched: matches.length,
      written,
      skipped: skipped.length,
      unmatched: unmatched.length,
    };
    if (debug) {
      report.debug = {
        provider_keys: provider[0] ? Object.keys(provider[0]) : [],
        provider_sample: provider.slice(0, 3),
        preview,
        skipped,
        unmatched,
      };
    }
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[econ-sync] Error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
