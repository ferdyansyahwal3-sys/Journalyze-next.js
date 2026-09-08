// app/api/og-image/route.ts
// Fetch OG image dari URL artikel — untuk berita yang RSS-nya tidak ada thumbnail
// Server-side agar bypass CORS

import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Whitelist domain artikel yang boleh di-fetch
const ALLOWED_DOMAINS = [
  'www.fxstreet.com', 'fxstreet.com',
  'www.forexlive.com', 'forexlive.com',
  'www.investing.com', 'investing.com',
  'www.marketwatch.com', 'marketwatch.com',
  'finance.yahoo.com',
  'www.reuters.com', 'reuters.com',
];

// Cache OG image in-memory sederhana (TTL 30 menit)
const cache = new Map<string, {url: string; ts: number}>();
const CACHE_TTL = 30 * 60 * 1000;

function extractOGImage(html: string, baseUrl: string): string {
  // Priority: og:image → twitter:image → article:image → img pertama yang besar
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
    /property=["']og:image:url["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) {
      const imgUrl = m[1].trim();
      if (imgUrl.startsWith('http')) return imgUrl;
      if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
      if (imgUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        return base.origin + imgUrl;
      }
    }
  }
  return '';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const articleUrl = searchParams.get('url');

  if (!articleUrl) {
    return NextResponse.json({ error: 'url param required' }, { status: 400, headers: CORS_HEADERS });
  }

  // Validasi URL
  let parsed: URL;
  try { parsed = new URL(articleUrl); } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400, headers: CORS_HEADERS });
  }

  // Whitelist check
  const allowed = ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
  if (!allowed) {
    return NextResponse.json({ error: 'domain not allowed' }, { status: 403, headers: CORS_HEADERS });
  }

  // Cek cache
  const cached = cache.get(articleUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ image: cached.url }, { headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=1800' } });
  }

  try {
    const res = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; OG-Fetcher)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json({ image: '' }, { headers: CORS_HEADERS });
    }

    // Ambil hanya 20KB pertama — cukup untuk tag head
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      let bytes = 0;
      while (bytes < 20000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        bytes += value?.length || 0;
        // Stop begitu ketemu </head>
        if (html.includes('</head>')) { reader.cancel(); break; }
      }
    }

    const imageUrl = extractOGImage(html, articleUrl);
    cache.set(articleUrl, { url: imageUrl, ts: Date.now() });

    return NextResponse.json(
      { image: imageUrl },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=900' } }
    );
  } catch {
    return NextResponse.json({ image: '' }, { headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
