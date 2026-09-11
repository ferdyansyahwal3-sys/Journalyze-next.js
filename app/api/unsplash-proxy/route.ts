// app/api/unsplash-proxy/route.ts
// Server-side proxy untuk Unsplash API — ambil gambar berdasarkan keyword berita
// Free tier: 50 requests/hour, cukup untuk news feed

import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache in-memory — keyword → image URL (TTL 1 jam)
const cache = new Map<string, { url: string; thumb: string; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

// Keyword mapping per kategori — untuk hasil yang relevan dan editorial
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  gold:     ['gold bars', 'gold coins', 'precious metals', 'bullion gold', 'gold market'],
  crypto:   ['bitcoin cryptocurrency', 'crypto trading', 'blockchain technology', 'digital currency'],
  fed:      ['federal reserve', 'wall street', 'stock exchange', 'dollar currency', 'banking finance'],
  economic: ['economy finance', 'stock market chart', 'financial data', 'business economy', 'trading floor'],
  forex:    ['currency exchange', 'forex trading', 'world currencies', 'foreign exchange', 'finance trading'],
};

// Extract keyword dari judul berita
function extractKeyword(title: string, category: string): string {
  const titleLower = title.toLowerCase();

  // Deteksi pair mata uang spesifik
  if (titleLower.includes('gold') || titleLower.includes('xau')) return 'gold bars market';
  if (titleLower.includes('bitcoin') || titleLower.includes('btc')) return 'bitcoin cryptocurrency';
  if (titleLower.includes('oil') || titleLower.includes('crude')) return 'oil industry petroleum';
  if (titleLower.includes('fed') || titleLower.includes('federal reserve')) return 'federal reserve banking';
  if (titleLower.includes('inflation') || titleLower.includes('cpi')) return 'inflation economy finance';
  if (titleLower.includes('interest rate') || titleLower.includes('rate hike')) return 'central bank interest rate';
  if (titleLower.includes('dollar') || titleLower.includes('usd')) return 'us dollar currency';
  if (titleLower.includes('euro') || titleLower.includes('eur')) return 'euro currency europe';
  if (titleLower.includes('yen') || titleLower.includes('japan')) return 'japanese yen tokyo finance';
  if (titleLower.includes('pound') || titleLower.includes('gbp')) return 'british pound london finance';
  if (titleLower.includes('china') || titleLower.includes('cny')) return 'china economy finance';
  if (titleLower.includes('stock') || titleLower.includes('equit')) return 'stock market wall street';
  if (titleLower.includes('nfp') || titleLower.includes('job') || titleLower.includes('employ')) return 'employment jobs economy';
  if (titleLower.includes('gdp') || titleLower.includes('growth')) return 'economic growth gdp';

  // Fallback ke keyword kategori (random dari list)
  const keywords = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.forex;
  return keywords[Math.floor(Math.random() * keywords.length)];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title    = searchParams.get('title') || '';
  const category = searchParams.get('category') || 'forex';
  const apiKey   = searchParams.get('key') || process.env.UNSPLASH_ACCESS_KEY || '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Unsplash API key required. Set UNSPLASH_ACCESS_KEY env var or pass ?key=...' },
      { status: 400, headers: CORS }
    );
  }

  const keyword = extractKeyword(title, category);
  const cacheKey = keyword;

  // Cek cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(
      { url: cached.url, thumb: cached.thumb, keyword, source: 'cache' },
      { headers: { ...CORS, 'Cache-Control': 'public, max-age=3600' } }
    );
  }

  try {
    // Unsplash random photo by query
    const unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(keyword)}&orientation=landscape&content_filter=high`;
    const r = await fetch(unsplashUrl, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => '');
      console.warn(`[unsplash] ${r.status}: ${err.slice(0, 100)}`);
      return NextResponse.json(
        { error: `Unsplash error: ${r.status}`, url: '', thumb: '' },
        { status: r.status, headers: CORS }
      );
    }

    const data = await r.json();
    const url   = data?.urls?.regular || data?.urls?.small || '';
    const thumb = data?.urls?.thumb   || data?.urls?.small  || url;

    // Simpan ke cache
    if (url) cache.set(cacheKey, { url, thumb, ts: Date.now() });

    return NextResponse.json(
      { url, thumb, keyword, source: 'unsplash', credit: data?.user?.name || '' },
      { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' } }
    );
  } catch (e) {
    console.error('[unsplash] Error:', (e as Error).message);
    return NextResponse.json({ error: String(e), url: '', thumb: '' }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
