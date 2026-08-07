import { NextRequest, NextResponse } from 'next/server';

// Domain yang diizinkan — identik dengan sources di fetchFromRSS index.html
const ALLOWED = [
  'investing.com',
  'yahoo.com',
  'feedburner.com',
  'fxstreet.com',
  'dailyfx.com',
  'forexlive.com',
  'forexfactory.com',
  'reuters.com',
  'bloomberg.com',
  'marketwatch.com',
  'ft.com',
  'cnbc.com',
  'babypips.com',
  'fxempire.com',
];

function isOk(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return ALLOWED.some(d => h.includes(d));
  } catch { return false; }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url required', xml: '' }, { status: 400, headers: cors });
  }
  if (!isOk(url)) {
    return NextResponse.json({ error: 'domain not allowed: ' + url, xml: '' }, { status: 403, headers: cors });
  }

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('Upstream HTTP ' + r.status);
    const xml = await r.text();
    return NextResponse.json({ xml }, { headers: cors });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, xml: '' },
      { status: 502, headers: cors }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}