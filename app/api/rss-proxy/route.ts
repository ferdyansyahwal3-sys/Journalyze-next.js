// app/api/rss-proxy/route.ts
// Port dari api/rss-proxy.js (Vercel serverless) → Next.js App Router Route Handler
// Fungsi: fetch RSS feed forex, parse XML → JSON, bypass CORS

import { NextRequest, NextResponse } from 'next/server';

// Feed forex yang di-support
const ALLOWED_DOMAINS = [
  'forexfactory.com',
  'dailyfx.com',
  'fxstreet.com',
  'investing.com',
  'marketwatch.com',
  'bloomberg.com',
  'reuters.com',
  'financialtimes.com',
  'cnbc.com',
  'ft.com',
  'fxempire.com',
  'babypips.com',
];

const DEFAULT_FEEDS = [
  'https://www.forexfactory.com/ff_calendar_thisweek.xml',
  'https://www.dailyfx.com/feeds/all',
  'https://www.fxstreet.com/rss/news',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

function parseRSSXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  // Extract channel title
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
  const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim() : 'Unknown Source';

  // Extract all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    
    const get = (tag: string): string => {
      // Handle CDATA
      const cdataMatch = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
      if (cdataMatch) return cdataMatch[1].trim();
      // Handle plain
      const plainMatch = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
      if (plainMatch) return plainMatch[1].trim();
      return '';
    };

    const title = get('title');
    const link = get('link') || get('guid');
    const description = get('description');
    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const category = get('category');
    const author = get('dc:creator') || get('author');
    
    // Ambil thumbnail dari media:content atau enclosure
    const mediaMatch = block.match(/media:content[^>]*url="([^"]+)"/);
    const enclosureMatch = block.match(/enclosure[^>]*url="([^"]+)"/);
    const thumbnail = mediaMatch?.[1] || enclosureMatch?.[1] || '';

    if (title && link) {
      items.push({
        title,
        link,
        description: description.replace(/<[^>]+>/g, '').substring(0, 200),
        pubDate,
        category,
        author,
        thumbnail,
        source: channelTitle,
      });
    }
  }

  return items;
}

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category: string;
  author: string;
  thumbnail: string;
  source: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');
  const multi = searchParams.get('multi'); // 'true' = fetch semua default feeds

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // cache 5 menit
  };

  try {
    // Mode multi: fetch semua default feeds sekaligus
    if (multi === 'true') {
      const results = await Promise.allSettled(
        DEFAULT_FEEDS.map(url =>
          fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; RSS Reader)',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: AbortSignal.timeout(8000),
          })
            .then(r => r.text())
            .then(xml => parseRSSXML(xml))
        )
      );

      const allItems: RSSItem[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') allItems.push(...r.value);
      });

      // Sort by pubDate terbaru
      allItems.sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db - da;
      });

      return NextResponse.json({ items: allItems.slice(0, 30) }, { headers: corsHeaders });
    }

    // Mode single URL
    if (!feedUrl) {
      return NextResponse.json(
        { error: 'Parameter url diperlukan' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isAllowedUrl(feedUrl)) {
      return NextResponse.json(
        { error: 'Domain tidak diizinkan' },
        { status: 403, headers: corsHeaders }
      );
    }

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0; RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Upstream ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const items = parseRSSXML(xml);

    return NextResponse.json({ items }, { headers: corsHeaders });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message, items: [] },
      { status: 502, headers: corsHeaders }
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