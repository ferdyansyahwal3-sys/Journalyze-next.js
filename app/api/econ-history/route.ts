// app/api/econ-history/route.ts
// History rilis sebelumnya untuk SATU event.
//   GET /api/econ-history?event=Non-Farm Employment Change&currency=USD
//
// Sebelumnya file ini salinan econ-calendar dan tidak membaca ?event=,
// sehingga panel history tidak pernah berfungsi.
// Sekarang data berasal dari snapshot sendiri di tabel `econ_events`.

import { NextRequest, NextResponse } from 'next/server';
import { _sbAdmin } from '@/lib/supabaseClient';
import { buildHistory, normalizeTitle, type SeriesRow } from '@/lib/econ';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const event = (sp.get('event') || '').trim();
  const currency = (sp.get('currency') || '').trim().toUpperCase();

  if (!event) {
    return NextResponse.json({ ok: false, error: 'Parameter event wajib diisi', history: [] }, { status: 400 });
  }

  try {
    let q = _sbAdmin
      .from('econ_events')
      .select('currency,release_at,actual,forecast,previous')
      .eq('title_key', normalizeTitle(event))
      .order('release_at', { ascending: true })
      .limit(500);
    if (currency) q = q.eq('currency', currency);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data || []) as (SeriesRow & { currency: string })[];

    // Judul yang sama bisa ada di banyak mata uang (mis. "CPI y/y") — jangan dicampur.
    const currencies = Array.from(new Set(rows.map(r => r.currency)));
    if (!currency && currencies.length > 1) {
      return NextResponse.json({ ok: true, ambiguous: true, history: [] });
    }

    const history = buildHistory(rows, new Date().toISOString());
    return NextResponse.json(
      { ok: true, history },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[econ-history] Error:', message);
    return NextResponse.json({ ok: false, error: message, history: [] }, { status: 500 });
  }
}
