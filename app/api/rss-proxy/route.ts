// app/api/rss-proxy/route.ts
// Port dari api/rss-proxy.js (Vercel serverless) → Next.js App Router Route Handler
// Logic identik dengan source asli — tidak ada perubahan perilaku

import { NextRequest, NextResponse } from 'next/server';

// Whitelist sumber RSS yang diizinkan — identik dengan source asli
// (keamanan agar tidak disalahgunakan sebagai open proxy)
const ALLOWED_DOMAINS = [
  'nfs.faireconomy.media',    // ForexFactory economic calendar JSON
  'feeds.feedburner.com',
  'www.dailyfx.com',
  'www.investing.com',
  'www.forexfactory.com',
  'rss.cnn.com',
  'feeds.reuters.com',
  'www.fxstreet.com',
  'www.marketwatch.com',
  'finance.yahoo.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Parameter url wajib diisi' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validasi URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'URL tidak valid' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Cek whitelist — exact match hostname atau subdomain
  const isAllowed = ALLOWED_DOMAINS.some(
    domain =>
      parsedUrl.hostname === domain ||
      parsedUrl.hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Domain tidak diizinkan: ' + parsedUrl.hostname },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        // Pura-pura browser biasa agar tidak di-block oleh RSS source
        'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.forexfactory.com/',
      },
      // Timeout 8 detik — identik source asli
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `RSS source mengembalikan status ${response.status}`,
          source: parsedUrl.hostname,
        },
        { status: response.status, headers: CORS_HEADERS }
      );
    }

    const xml = await response.text();

    if (!xml || xml.trim().length === 0) {
      return NextResponse.json(
        { error: 'RSS source mengembalikan konten kosong' },
        { status: 204, headers: CORS_HEADERS }
      );
    }

    // Cache di CDN selama 10 menit — identik source asli (s-maxage=600)
    return NextResponse.json(
      { xml, source: parsedUrl.hostname, fetchedAt: new Date().toISOString() },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 's-maxage=600, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    const error = err as Error;

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'RSS source timeout setelah 8 detik', source: parsedUrl.hostname },
        { status: 504, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { error: 'Gagal fetch RSS: ' + error.message, source: parsedUrl.hostname },
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