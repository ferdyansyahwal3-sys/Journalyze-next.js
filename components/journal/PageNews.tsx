// components/journal/PageNews.tsx
// Migrasi 1:1 dari index.html section#page-news
// Semua CSS class, logic filter/sort, render functions identik dengan source
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Constants (identik dengan index.html) ─────────────────────────────────────
const NEWS_CACHE_KEY = 'jz_forex_news_v3';
const NEWS_CACHE_TTL = 30 * 60 * 1000;
const NEWS_PER_PAGE  = 9;
const EC_CACHE_KEY   = 'jz_econ_cal_v2';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NewsItem {
  id: string; title: string; desc: string; source: string;
  time: string; url: string;
  category: 'forex'|'gold'|'crypto'|'economic'|'fed';
  impact: 'high'|'medium'|'low';
  emoji: string; pairs?: string[];
  analysis?: string; speculation?: string;
  scenario_bear?: string; scenario_bull?: string; headline?: string;
  thumbnail?: string; _isMock?: boolean;
}

interface EconEvent {
  day: string; timeWIB: string; flag: string; name: string;
  forecast: string; prev: string; actual?: string;
  impact: 'high'|'medium'|'low';
}

type Cat = 'all'|'forex'|'gold'|'crypto'|'economic'|'fed';
type SortMode = 'newest'|'impact';

// ── Helpers (port dari index.html) ────────────────────────────────────────────
function escHtml(s: string): string {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff/60) + 'm lalu';
    if (diff < 86400) return Math.floor(diff/3600) + 'j lalu';
    return Math.floor(diff/86400) + 'h lalu';
  } catch { return '—'; }
}

function fmtWIB(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const wib = new Date(d.getTime() + 7*3600*1000);
    return String(wib.getUTCHours()).padStart(2,'0')+':'+String(wib.getUTCMinutes()).padStart(2,'0')+' WIB';
  } catch { return '—'; }
}

function getCatLabel(cat: string): string {
  return ({gold:'🥇 Gold',crypto:'₿ Crypto',fed:'🇺🇸 Fed/USD',economic:'📊 Ekonomi',forex:'💱 Forex'} as Record<string,string>)[cat] || '📰 Forex';
}

function getCatEmoji(cat: string): string {
  return ({gold:'🥇',crypto:'₿',fed:'🇺🇸',economic:'📊',forex:'💱'} as Record<string,string>)[cat] || '📰';
}

// NEWS_CAT_KEYS — identik dengan index.html
const NEWS_CAT_KEYS: Record<string, string[]> = {
  gold:     ['gold','xauusd','xau','bullion','precious metal','emas'],
  crypto:   ['bitcoin','btc','ethereum','crypto','blockchain','altcoin','defi'],
  fed:      ['federal reserve','fed','fomc','powell','rate hike','rate cut','usd index','dxy','dollar index'],
  economic: ['inflation','gdp','cpi','ppi','unemployment','nonfarm','payroll','economic data','oecd','imf','recession'],
  forex:    ['forex','currency','eur','gbp','jpy','usdjpy','eurusd','gbpusd','exchange rate','central bank','pips'],
};

function detectCategory(title: string, desc: string): NewsItem['category'] {
  const txt = (title+' '+desc).toLowerCase();
  for (const [cat, keys] of Object.entries(NEWS_CAT_KEYS)) {
    if (keys.some(k => txt.includes(k))) return cat as NewsItem['category'];
  }
  return 'forex';
}

function detectImpact(title: string, desc: string): NewsItem['impact'] {
  const txt = (title+' '+desc).toLowerCase();
  const hi = ['nonfarm payroll','non-farm payroll','nfp','jobs report','fomc','federal reserve meeting',
    'rate decision','interest rate decision','rate hike','rate cut','cpi report','consumer price index',
    'inflation data','inflation report','ppi report','producer price index','gdp report','gdp data',
    'unemployment rate','jobless claims','powell','lagarde','fed chair','monetary policy statement',
    'monetary policy decision','ecb decision','boj decision','boe decision','rba decision'];
  const lo = ['minor','slight','stable','sideways','consolidat','unchanged','ipo','earnings report',
    'quarterly result','dividend','stock split','drone','sports','weather','entertainment'];
  if (hi.some(w => txt.includes(w))) return 'high';
  if (lo.some(w => txt.includes(w))) return 'low';
  return 'medium';
}

const PAIR_MAP: Record<string,string> = {
  'gold':'XAUUSD','xauusd':'XAUUSD','xau':'XAUUSD',
  'eurusd':'EURUSD','eur/usd':'EURUSD','euro':'EURUSD',
  'gbpusd':'GBPUSD','gbp/usd':'GBPUSD','pound':'GBPUSD',
  'usdjpy':'USDJPY','usd/jpy':'USDJPY','yen':'USDJPY',
  'audusd':'AUDUSD','aud/usd':'AUDUSD','aussie':'AUDUSD',
  'bitcoin':'BTCUSD','btc':'BTCUSD','crypto':'BTCUSD',
};
function extractPairs(title: string): string[] {
  const txt = title.toLowerCase();
  const found = new Set<string>();
  for (const [k,v] of Object.entries(PAIR_MAP)) { if (txt.includes(k)) found.add(v); }
  return found.size ? [...found] : [];
}

// RSS XML parser — identik dengan parseRSSXML di index.html
function parseRSSXML(xml: string, srcUrl: string): {title:string;desc:string;link:string;pubDate:string;thumbnail:string}[] {
  const items: {title:string;desc:string;link:string;pubDate:string;thumbnail:string}[] = [];
  const getFromBlock = (block: string, tag: string): string => {
    const cdataRe = new RegExp('<'+tag+'[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/'+tag+'>');
    const plainRe  = new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>');
    const m = block.match(cdataRe) || block.match(plainRe);
    return m ? (m[1]||'').trim() : '';
  };
  const getThumbnail = (block: string): string => {
    const media = block.match(/media:content[^>]*url=["']([^"']+)["']/);
    const encl = block.match(/enclosure[^>]*url=["']([^"']+)["']/);
    const imgTag = block.match(/<img[^>]+src=["']([^"']+)["']/);
    return media?.[1] || encl?.[1] || imgTag?.[1] || '';
  };

  // RSS <item>
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = getFromBlock(block,'title');
    const desc  = (getFromBlock(block,'description')||getFromBlock(block,'summary')).replace(/<[^>]+>/g,'').slice(0,220);
    const link  = getFromBlock(block,'link') || srcUrl;
    const pubDate = getFromBlock(block,'pubDate')||getFromBlock(block,'dc:date')||getFromBlock(block,'published')||new Date().toISOString();
    const thumbnail = getThumbnail(block);
    if (!title) continue;
    items.push({title, desc, link, pubDate, thumbnail});
  }

  // Atom <entry>
  if (items.length === 0) {
    const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    while ((m = entryRe.exec(xml)) !== null) {
      const block = m[1];
      const title = getFromBlock(block,'title');
      const desc  = (getFromBlock(block,'summary')||getFromBlock(block,'content')||getFromBlock(block,'description')).replace(/<[^>]+>/g,'').slice(0,220);
      const lhref = block.match(/<link[^>]+href=["']([^"']+)["']/);
      const link  = lhref ? lhref[1] : (getFromBlock(block,'link')||srcUrl);
      const pubDate = getFromBlock(block,'published')||getFromBlock(block,'updated')||getFromBlock(block,'pubDate')||new Date().toISOString();
      const thumbnail = getThumbnail(block);
      if (!title) continue;
      items.push({title, desc, link, pubDate, thumbnail});
    }
  }
  return items;
}

// Flag resolver — identik dengan resolveFlag di index.html
const FLAG_LIB: Record<string,string> = {USD:'🇺🇸',EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',AUD:'🇦🇺',NZD:'🇳🇿',CAD:'🇨🇦',CHF:'🇨🇭',CNY:'🇨🇳',KRW:'🇰🇷'};
const TITLE_CUR: [RegExp, string][] = [
  [/\bfed\b|fomc|nonfarm|non.farm|payroll|jobless|unemployment|\bcpi\b|\bppi\b|ism|\buom\b|consumer sentiment|inflation expect|crude oil|dollar/i,'USD'],
  [/\becb\b|eurozone|euro.?zone|german|refinanc|eurogroup|sentix|zew|ifo/i,'EUR'],
  [/\bboc\b|canada|canadian|overnight rate/i,'CAD'],
  [/\bboe\b|\buk\b|britain|british|sterling|claimant|rics|nationwide/i,'GBP'],
  [/\bboj\b|japan|japanese|tokyo|tankan/i,'JPY'],
  [/\brba\b|australia|aussie|westpac/i,'AUD'],
  [/\brbnz\b|new zealand|kiwi/i,'NZD'],
  [/\bsnb\b|swiss|switzerland/i,'CHF'],
  [/\bpboc\b|china|chinese|yuan/i,'CNY'],
];
function resolveFlag(ev: {flag?:string;currency?:string;name?:string}): string {
  if (ev.flag && ev.flag !== '🌐') return ev.flag;
  const c = (ev.currency||'').toUpperCase();
  if (FLAG_LIB[c]) return FLAG_LIB[c];
  const t = (ev.name||'').toLowerCase();
  for (const [re, code] of TITLE_CUR) { if (re.test(t)) return FLAG_LIB[code]; }
  return '🌐';
}

// getWeekStart — WIB-aware, identik dengan _getWeekStart di index.html
function getWeekStart(): string {
  const n = new Date(Date.now()+7*3600*1000);
  const dw = n.getUTCDay();
  const df = dw === 0 ? 1 : 1 - dw;
  const m = new Date(n);
  m.setUTCDate(n.getUTCDate()+df);
  return m.getUTCFullYear()+'-'+String(m.getUTCMonth()+1).padStart(2,'0')+'-'+String(m.getUTCDate()).padStart(2,'0');
}

function getTodayWIB(): string {
  const n = new Date(Date.now()+7*3600*1000);
  return n.getUTCFullYear()+'-'+String(n.getUTCMonth()+1).padStart(2,'0')+'-'+String(n.getUTCDate()).padStart(2,'0');
}

// mapCalEvents — filter high/medium, sort by day, identik dengan _mapCalEvents
function mapCalEvents(evs: {date?:string;isoTime?:string;impact?:string;name?:string;title?:string;forecast?:string;prev?:string;previous?:string;actual?:string;flag?:string;currency?:string}[]): EconEvent[] {
  const DAY = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const ORDER = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  return evs
    .filter(ev => { const i = (ev.impact||'').toLowerCase(); return i==='high'||i==='medium'||i==='med'; })
    .map(ev => {
      const d = new Date((ev.date||ev.isoTime||''));
      const w = new Date(d.getTime()+7*3600*1000);
      return {
        day: DAY[w.getUTCDay()] || '—',
        timeWIB: String(w.getUTCHours()).padStart(2,'0')+':'+String(w.getUTCMinutes()).padStart(2,'0')+' WIB',
        flag: resolveFlag(ev),
        name: ev.name||ev.title||'—',
        forecast: ev.forecast||'—',
        prev: ev.prev||ev.previous||'—',
        actual: ev.actual||'',
        impact: ((ev.impact||'medium').toLowerCase() as 'high'|'medium'|'low'),
      };
    })
    .sort((a,b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day));
}

// RSS sources — identik dengan fetchFromRSS di index.html
const RSS_SOURCES = [
  {url:'https://www.investing.com/rss/news_25.rss',name:'Investing.com'},
  {url:'https://finance.yahoo.com/rss/topstories',name:'Yahoo Finance'},
  {url:'https://feeds.feedburner.com/forexlive',name:'ForexLive'},
  {url:'https://www.fxstreet.com/rss/news',name:'FXStreet'},
  {url:'https://www.dailyfx.com/feeds/all',name:'DailyFX'},
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PageNews({ active }: { active: boolean }) {
  const [allData, setAllData]       = useState<NewsItem[]>([]);
  const [events, setEvents]         = useState<EconEvent[]>([]);
  const [state, setState]           = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [lastFetch, setLastFetch]   = useState(0);
  const [cat, setCat]               = useState<Cat>('all');
  const [sort, setSort]             = useState<SortMode>('newest');
  const [page, setPage]             = useState(1);
  const [calLoading, setCalLoading] = useState(false);
  const [calTitle, setCalTitle]     = useState('📅 Economic Calendar — Minggu Ini');
  const [expandedSpec, setExpandedSpec] = useState<Record<string,boolean>>({});
  const loadingRef = useRef(false);

  // ── Fetch RSS — identik dengan fetchFromRSS ───────────────────────────────
  const fetchRSS = useCallback(async (): Promise<NewsItem[]> => {
    const results: NewsItem[] = [];
    for (const src of RSS_SOURCES) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 7000);
        const r = await fetch('/api/rss-proxy?url='+encodeURIComponent(src.url), {signal: ctrl.signal});
        clearTimeout(tid);
        if (!r.ok) continue;
        const d = await r.json();
        if (d.xml && d.xml.length > 100) {
          const raw = parseRSSXML(d.xml, src.url);
          const items = raw.slice(0,8).map((item, i) => ({
            id: src.name+'_'+i,
            title: item.title,
            desc: item.desc || '',
            source: src.name,
            time: item.pubDate,
            url: item.link,
            thumbnail: item.thumbnail || '',
            category: detectCategory(item.title, item.desc||''),
            impact: detectImpact(item.title, item.desc||''),
            emoji: getCatEmoji(detectCategory(item.title, item.desc||'')),
            pairs: extractPairs(item.title),
            analysis: '', speculation: '',
          }));
          results.push(...items);
        }
      } catch { /* continue */ }
    }
    return results;
  }, []);

  // ── Load news — identik dengan loadForexNews ──────────────────────────────
  const loadNews = useCallback(async (force = false) => {
    if (loadingRef.current) return;
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY)||'null');
        if (c && (Date.now()-c.ts) < NEWS_CACHE_TTL && c.items?.length) {
          setAllData(c.items); setLastFetch(c.ts); setState('ok'); return;
        }
      } catch { /* ignore */ }
    }
    loadingRef.current = true;
    setState('loading');
    try {
      let items = await fetchRSS();
      // deduplicate
      const seen = new Set<string>();
      items = items.filter(n => {
        const k = n.title.slice(0,35).toLowerCase().replace(/\s+/g,'');
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      // sort newest
      items.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      const ts = Date.now();
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ts, items}));
      setAllData(items); setLastFetch(ts); setState('ok');
    } catch {
      setState('ok');
    } finally {
      loadingRef.current = false;
    }
  }, [fetchRSS]);

  // ── Load calendar — identik dengan loadEconomicCalendar ──────────────────
  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    const ws = getWeekStart();
    const today = getTodayWIB();
    const LCKEY = EC_CACHE_KEY+'_'+ws;
    const FETCH_KEY = EC_CACHE_KEY+'_fetched_'+today;
    const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const mn = new Date(ws+'T00:00:00Z');
    const fr = new Date(mn); fr.setUTCDate(mn.getUTCDate()+4);
    setCalTitle(`📅 ECONOMIC CALENDAR — ${mn.getUTCDate()} ${MO[mn.getUTCMonth()]} – ${fr.getUTCDate()} ${MO[fr.getUTCMonth()]} ${fr.getUTCFullYear()}`);

    try {
      // Cek localStorage cache
      const alreadyFetched = localStorage.getItem(FETCH_KEY) === '1';
      const lc = JSON.parse(localStorage.getItem(LCKEY)||'null');
      if (alreadyFetched && lc?.length) {
        setEvents(mapCalEvents(lc)); setCalLoading(false); return;
      }
      // Fetch dari API
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch('/api/econ-calendar', {signal: ctrl.signal});
      if (!r.ok) throw new Error('HTTP '+r.status);
      const d = await r.json();
      const raw = d.events ?? d.ok ? d.events : null;
      if (raw?.length) {
        const enriched = raw.map((ev: {flag?:string;currency?:string;name?:string}) => ({...ev, flag: resolveFlag(ev)}));
        localStorage.setItem(LCKEY, JSON.stringify(enriched));
        localStorage.setItem(FETCH_KEY, '1');
        setEvents(mapCalEvents(enriched));
      } else {
        throw new Error('empty');
      }
    } catch {
      // fallback localStorage
      try {
        const lc = JSON.parse(localStorage.getItem(EC_CACHE_KEY+'_'+ws)||'null');
        if (lc?.length) { setEvents(mapCalEvents(lc)); setCalLoading(false); return; }
      } catch { /* ignore */ }
      setEvents([]);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && state === 'idle') { loadNews(false); loadCalendar(); }
  }, [active, state, loadNews, loadCalendar]);

  // ── Computed values (identik dengan renderSentimentPanel + renderMarketSpeculation) ─
  const bullWords = ['rally','bullish','gains','rises','higher','strong','surge','breakout','positive','naik','menguat','tembus'];
  const bearWords = ['falls','drops','bearish','weak','decline','crash','negative','koreksi','melemah','tertekan','turun'];
  let bull = 0, bear = 0;
  allData.forEach(n => {
    const t = (n.title+' '+(n.desc||'')).toLowerCase();
    if (bullWords.some(w => t.includes(w))) bull++;
    if (bearWords.some(w => t.includes(w))) bear++;
  });
  const pct = bull+bear > 0 ? Math.round(bull/(bull+bear)*100) : 50;
  const sentiment = pct > 55 ? 'bullish' : pct < 45 ? 'bearish' : 'neutral';
  const sentMap = {
    bullish: {lbl:'Risk-On 📈', col:'var(--green)', card:'bullish', icon:'📈'},
    bearish: {lbl:'Risk-Off 📉', col:'var(--red)',   card:'bearish', icon:'📉'},
    neutral: {lbl:'Mixed ↔️',   col:'var(--gold2)', card:'neutral', icon:'↔️'},
  };
  const sm = sentMap[sentiment];
  const hiImpact = allData.filter(n => n.impact==='high').length;
  const goldN = allData.filter(n => n.category==='gold').length;
  const moodLabel = bull>bear ? 'Risk-On 📈 — pasar cenderung bullish' : bear>bull ? 'Risk-Off 📉 — tekanan jual dominan' : 'Mixed ↔️ — sentimen bercampur';
  const moodColor = bull>bear ? 'var(--green)' : bear>bull ? 'var(--red)' : 'var(--gold2)';

  // Filter & sort — identik dengan getFilteredAndSorted
  let filtered = [...allData];
  if (cat !== 'all') filtered = filtered.filter(n => n.category === cat);
  if (sort === 'impact') {
    const ord: Record<string,number> = {high:0, medium:1, low:2};
    filtered.sort((a,b) => (ord[a.impact]||1)-(ord[b.impact]||1));
  }
  const shown = filtered.slice(0, page * NEWS_PER_PAGE);
  const hasMore = filtered.length > shown.length;

  const counts = {forex:0, gold:0, crypto:0, economic:0, fed:0};
  allData.forEach(n => { if ((counts as Record<string,number>)[n.category] !== undefined) (counts as Record<string,number>)[n.category]++; });

  const ageStr = lastFetch ? (
    Date.now()-lastFetch < 60000 ? 'baru saja' :
    Date.now()-lastFetch < 3600000 ? Math.round((Date.now()-lastFetch)/60000)+'m lalu' :
    Math.round((Date.now()-lastFetch)/3600000)+'j lalu'
  ) : '—';

  const highItems = allData.filter(n => n.impact==='high').slice(0,2);
  const medItems  = allData.filter(n => n.impact==='medium'||n.impact==='med' as unknown).slice(0,2);
  const hasSpec   = highItems.length > 0 || medItems.length > 0;

  const resetAICache = () => {
    localStorage.removeItem(NEWS_CACHE_KEY);
    localStorage.removeItem('jz_news_ai_summary');
    loadNews(true); loadCalendar();
  };

  // ── calTitle parse helper ─────────────────────────────────────────────────
  const calTitleParts = calTitle.split('—');
  const calTitleMain = calTitleParts[0]?.trim() || '';
  const calTitleDate = calTitleParts[1]?.trim() || '';

  return (
    <section id="page-news" className={`page${active?' active':''}`}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="ph ai-anim">
        <div>
          <div className="ph-label">📰 Modul 07 — Market Intelligence</div>
          <h1 className="ph-title">Berita <em>Forex</em></h1>
          <p className="ph-sub">Update pasar terkini — fundamental, sentimen, dan event ekonomi yang mempengaruhi pair kamu.</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap' as const}}>
          <button className="btn btn-gold" onClick={() => loadNews(true)} id="news-refresh-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <button className="btn btn-ghost btn-sm" onClick={resetAICache}>🗑 Reset AI Cache</button>
        </div>
      </div>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="ticker ai-anim d1" id="news-ticker-wrap" style={{marginBottom:'20px'}}>
        <div className="ticker-dot" style={{
          background: state==='loading' ? 'var(--gold)' : state==='ok' ? 'var(--green)' : 'var(--text3)',
          animation: state==='loading' ? 'pulse 1s infinite' : state==='ok' ? 'pulse 2s infinite' : 'none',
        }} />
        <div className="ticker-label">News Feed</div>
        <div className="ticker-items">
          {state === 'loading' ? (
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'9.5px',color:'var(--text3)'}}>Memuat berita...</span>
          ) : allData.length > 0 ? (
            <>
              <div className="ticker-item"><span className="ticker-pair">📰 Total</span><span className="ticker-rate">{allData.length}</span></div>
              <span style={{color:'var(--text4)',fontSize:'8px'}}>|</span>
              <div className="ticker-item"><span className="ticker-pair">💱 Forex</span><span className="ticker-rate">{counts.forex}</span></div>
              <span style={{color:'var(--text4)',fontSize:'8px'}}>|</span>
              <div className="ticker-item"><span className="ticker-pair">🥇 Gold</span><span className="ticker-rate">{counts.gold}</span></div>
              <span style={{color:'var(--text4)',fontSize:'8px'}}>|</span>
              <div className="ticker-item"><span className="ticker-pair">📊 Ekonomi</span><span className="ticker-rate">{counts.economic}</span></div>
              <span style={{color:'var(--text4)',fontSize:'8px'}}>|</span>
              <div className="ticker-item"><span className="ticker-pair">🏦 Fed/USD</span><span className="ticker-rate">{counts.fed}</span></div>
            </>
          ) : (
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'9.5px',color:'var(--text3)'}}>Belum ada data</span>
          )}
        </div>
        <div className="ticker-time">{ageStr}</div>
      </div>

      {/* ── Filter ──────────────────────────────────────────────────────── */}
      <div className="box ai-anim d1" style={{marginBottom:'20px'}}>
        <div className="box-head">
          <div className="box-title">🔍 Filter Berita</div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span id="news-count-badge" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'9px',color:'var(--text3)'}}>{filtered.length} artikel</span>
          </div>
        </div>
        <div className="box-body" style={{padding:'12px 18px'}}>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap' as const,alignItems:'center'}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase' as const,color:'var(--text3)',flexShrink:0}}>Kategori:</span>
            <div id="news-filter-chips" className="chip-group">
              {(['all','forex','gold','crypto','economic','fed'] as const).map(c => (
                <div key={c} className={`chip-opt${cat===c?' sel':''}`} data-cat={c}
                  onClick={() => { setCat(c); setPage(1); }}>
                  {c==='all'?'📰 Semua':c==='forex'?'💱 Forex':c==='gold'?'🥇 Gold/XAUUSD':c==='crypto'?'₿ Crypto':c==='economic'?'🏦 Ekonomi':'🇺🇸 Fed/USD'}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'6px',alignItems:'center',marginLeft:'auto'}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase' as const,color:'var(--text3)'}}>Urutan:</span>
              <div id="sort-newest" className={`chip-opt${sort==='newest'?' sel':''}`} onClick={() => { setSort('newest'); setPage(1); }}>Terbaru</div>
              <div id="sort-impact" className={`chip-opt${sort==='impact'?' sel':''}`} onClick={() => { setSort('impact'); setPage(1); }}>Impact</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      <div id="news-loading" style={{display:state==='loading'?'block':'none'}}>
        <div className="box" style={{marginBottom:'16px'}}>
          <div className="box-body" style={{padding:'40px 20px',textAlign:'center' as const}}>
            <div style={{fontSize:'32px',marginBottom:'14px',animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase' as const,color:'var(--gold2)',marginBottom:'6px'}}>Mengambil berita terkini...</div>
            <div style={{fontSize:'11px',color:'var(--text3)'}}>Sedang menghubungi sumber berita forex global</div>
          </div>
        </div>
      </div>

      {/* ── Sentiment Panel ──────────────────────────────────────────────── */}
      <div id="news-sentiment-panel" style={{display:state==='ok'&&allData.length>0?'block':'none'}}>
        <div className="g3 ai-anim d1" style={{marginBottom:'20px'}}>
          <div className={`sentiment-card ${sm.card}`}>
            <div className="sentiment-icon">{sm.icon}</div>
            <div className="sentiment-label">Sentimen Pasar</div>
            <div className="sentiment-value" style={{color:sm.col}}>{sm.lbl}</div>
            <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'4px'}}>{bull} bullish · {bear} bearish</div>
          </div>
          <div className={`sentiment-card ${hiImpact>3?'bearish':hiImpact>1?'neutral':'bullish'}`}>
            <div className="sentiment-icon">{hiImpact>3?'🔴':hiImpact>1?'🟡':'🟢'}</div>
            <div className="sentiment-label">Volatilitas Ekspektasi</div>
            <div className="sentiment-value">{hiImpact>4?'Sangat Tinggi':hiImpact>2?'Tinggi':hiImpact>0?'Sedang':'Rendah'}</div>
            <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'4px'}}>{hiImpact} event high impact</div>
          </div>
          <div className={`sentiment-card ${goldN>2?'bullish':'neutral'}`}>
            <div className="sentiment-icon">🥇</div>
            <div className="sentiment-label">Fokus XAUUSD</div>
            <div className="sentiment-value" style={{color:'var(--gold2)'}}>{goldN} artikel</div>
            <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'4px'}}>Gold coverage hari ini</div>
          </div>
        </div>
      </div>

      {/* ── Economic Calendar ─────────────────────────────────────────────── */}
      <div id="news-events-section" style={{display:state==='ok'||calLoading?'block':'none',marginBottom:'20px'}}>
        <div className="box ai-anim d2">
          <div className="box-head">
            <div className="box-title">
              {calTitleMain} &mdash; <span style={{color:'var(--gold2)'}}>{calTitleDate}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--red)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--red)',display:'inline-block'}} />High</span>
              <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--gold2)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--gold2)',display:'inline-block'}} />Med</span>
              <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--green)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}} />Low</span>
            </div>
          </div>
          <div className="box-body-0">
            <div style={{padding:'4px 0',maxHeight:'497px',overflowY:'auto' as const,scrollbarWidth:'thin' as const,scrollbarColor:'var(--gold2) transparent'}}>
              {calLoading ? (
                <div style={{padding:'16px',textAlign:'center' as const,color:'var(--text3)',fontSize:'12px'}}>⏳ Memuat kalender...</div>
              ) : events.length === 0 ? (
                <div style={{padding:'16px',textAlign:'center' as const,color:'var(--text3)',fontSize:'12px'}}>Tidak ada event ekonomi minggu ini</div>
              ) : events.map((ev, i) => (
                <div key={i} className="event-item">
                  <div className="event-time">
                    <span className="event-time-day">{ev.day}</span>
                    <span className="event-time-hour">{ev.timeWIB}</span>
                  </div>
                  <div className="event-flag">{ev.flag}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="event-name">{ev.name}</div>
                    <div className="event-prev">
                      Forecast: <strong style={{color:'var(--gold2)'}}>{ev.forecast}</strong> &middot; Prev: {ev.prev}
                      {ev.actual && <span style={{marginLeft:'6px',color:'var(--green)',fontWeight:600}}> Actual: {ev.actual}</span>}
                    </div>
                  </div>
                  <div className={`event-impact-dot ${ev.impact}`} title={ev.impact+' impact'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Spekulasi AI ──────────────────────────────────────────────────── */}
      <div id="news-speculation-section" style={{display:state==='ok'&&hasSpec?'block':'none',marginBottom:'20px'}}>
        <div className="box ai-anim d2">
          <div className="box-head">
            <div className="box-title">📊 Kesimpulan &amp; Spekulasi AI</div>
            <span id="news-spec-mood" style={{
              fontFamily:"'JetBrains Mono',monospace",fontSize:'9px',padding:'5px 10px',
              background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',color:moodColor
            }}>Overall: {moodLabel}</span>
          </div>
          <div className="box-body" style={{padding:'0'}}>
            <div style={{padding:'8px 18px',fontSize:'10px',color:'var(--text3)',borderBottom:'1px solid var(--border2)',display:'flex',gap:'16px',flexWrap:'wrap' as const,fontFamily:"'JetBrains Mono',monospace"}}>
              <span>📊 Analisis = dampak fundamental</span>
              <span>🎯 Spekulasi = proyeksi harga</span>
              <span>📰 Desc = ringkasan berita</span>
            </div>
            <div id="news-spec-body">
              {/* HIGH IMPACT */}
              {highItems.length > 0 && (
                <>
                  <div className="spec-section-header spec-high">
                    <span className="spec-section-dot high" />
                    <span>HIGH IMPACT</span>
                    <span className="spec-section-count">{highItems.length} event</span>
                  </div>
                  {highItems.map((n, i) => {
                    const sid = 'h'+i;
                    return (
                      <div key={sid} className={`spec-item${i===highItems.length-1&&medItems.length===0?' spec-item-last':''}`}>
                        <div className="spec-item-header">
                          <span className={`news-card-cat ${n.category}`}>{getCatLabel(n.category)}</span>
                          <span className={`news-card-impact ${n.impact}`}>{n.impact==='high'?'🔴 High':n.impact==='medium'?'🟡 Medium':'🟢 Low'}</span>
                          {n.pairs?.slice(0,3).map(p => <span key={p} className="chip chip-gold" style={{fontSize:'8px'}}>{p}</span>)}
                          {n.source && <span className="spec-source">{escHtml(n.source)}</span>}
                        </div>
                        <div className="spec-news-title">{n.title}</div>
                        {n.analysis||n.speculation ? (
                          !expandedSpec[sid] ? (
                            <div className="spec-preview">
                              {n.desc||(n.analysis||'').slice(0,120)}
                              <button className="spec-readmore" onClick={() => setExpandedSpec(p=>({...p,[sid]:true}))}>▾ Baca selengkapnya</button>
                            </div>
                          ) : (
                            <div className="spec-full">
                              {n.analysis && <div className="spec-analysis-full">{n.analysis}</div>}
                              {n.scenario_bear && <div className="spec-scenario bear"><span>🔴 Bearish:</span> {n.scenario_bear}</div>}
                              {n.scenario_bull && <div className="spec-scenario bull"><span>🟢 Bullish:</span> {n.scenario_bull}</div>}
                              {n.speculation && <div className="spec-analysis"><span className="spec-badge spekulasi">🎯 Bias</span><span>{n.speculation}</span></div>}
                              <button className="spec-readmore" style={{marginTop:'6px'}} onClick={() => setExpandedSpec(p=>({...p,[sid]:false}))}>▴ Sembunyikan</button>
                            </div>
                          )
                        ) : (
                          <div className="spec-no-ai">⚡ Aktifkan AI untuk analisis otomatis</div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {/* MARKET UPDATE */}
              {medItems.length > 0 && (
                <>
                  <div className={`spec-section-header spec-med${highItems.length?' spec-section-border':''}`}>
                    <span className="spec-section-dot med" />
                    <span>MARKET UPDATE</span>
                    <span className="spec-section-count">{medItems.length} berita</span>
                  </div>
                  {medItems.map((n, i) => {
                    const sid = 'm'+i;
                    return (
                      <div key={sid} className={`spec-item${i===medItems.length-1?' spec-item-last':''}`}>
                        <div className="spec-item-header">
                          <span className={`news-card-cat ${n.category}`}>{getCatLabel(n.category)}</span>
                          <span className={`news-card-impact ${n.impact}`}>{n.impact==='high'?'🔴 High':n.impact==='medium'?'🟡 Medium':'🟢 Low'}</span>
                          {n.pairs?.slice(0,3).map(p => <span key={p} className="chip chip-gold" style={{fontSize:'8px'}}>{p}</span>)}
                          {n.source && <span className="spec-source">{escHtml(n.source)}</span>}
                        </div>
                        <div className="spec-news-title">{n.title}</div>
                        <div className="spec-no-ai">⚡ Aktifkan AI untuk analisis otomatis</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── News Cards ────────────────────────────────────────────────────── */}
      <div id="news-cards-container">
        {(state==='idle'||(state==='loading'&&allData.length===0)) ? (
          <div className="ph-empty" style={{padding:'60px 20px'}}>
            <div className="ph-icon">📰</div>
            Belum ada berita dimuat. Klik tombol Refresh.
          </div>
        ) : filtered.length === 0 ? (
          <div className="news-empty">
            <div className="news-empty-icon">🔍</div>
            <div className="news-empty-txt">Tidak ada berita untuk kategori ini</div>
            <div style={{fontSize:'11px',color:'var(--text3)',marginTop:'4px'}}>Coba kategori lain atau refresh</div>
          </div>
        ) : (
          <div className="news-grid">
            {shown.map((n, i) => {
              const featured = i===0 && cat==='all';
              const destUrl = (n.url && n.url !== '#') ? n.url : 'https://www.forexfactory.com/news';
              return (
                <div
                  key={n.id||i}
                  className={`news-card${featured?' news-featured':''}`}
                  onClick={() => window.open(destUrl,'_blank','noopener')}
                  style={{animationDelay:`${Math.min(i*0.035,0.3)}s`,cursor:'pointer'}}
                >
                  {n._isMock && (
                    <div style={{background:'rgba(255,180,0,0.08)',borderBottom:'1px solid rgba(255,180,0,0.2)',padding:'5px 12px',fontSize:'9px',fontFamily:"'JetBrains Mono',monospace",color:'#a07a20',letterSpacing:'1px',textTransform:'uppercase' as const}}>
                      ⚠ Data Contoh — RSS Gagal Dimuat
                    </div>
                  )}
                  {n.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.thumbnail} alt="" className="news-card-img" loading="lazy"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                    />
                  ) : (
                    <div className="news-card-img-placeholder">{n.emoji||'📰'}</div>
                  )}
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <span className="news-card-source">{escHtml(n.source)}</span>
                      <span className={`news-card-cat ${n.category}`}>{getCatLabel(n.category)}</span>
                      <span className="news-card-time">🕐 {timeAgo(n.time)}</span>
                      <span className="news-card-wib">📅 {fmtWIB(n.time)}</span>
                    </div>
                    <div className="news-card-title">{n.title}</div>
                    <div className="news-card-desc">{n.desc}</div>
                    {n.pairs?.length ? (
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap' as const,marginBottom:'8px'}}>
                        {n.pairs.slice(0,4).map(p => <span key={p} className="chip chip-gold" style={{fontSize:'7.5px'}}>{p}</span>)}
                      </div>
                    ) : null}
                    {n.analysis && (
                      <div className="news-analysis-box">
                        <span className="spec-badge analysis">📊 Analisis</span>
                        <span className="news-analysis-txt">{n.analysis}</span>
                      </div>
                    )}
                    <div className="news-card-footer">
                      <span className={`news-card-impact ${n.impact}`}>
                        {n.impact==='high'?'🔴 High Impact':n.impact==='medium'?'🟡 Medium':'🟢 Low Impact'}
                      </span>
                      <span className="news-card-read">Baca →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Load More ─────────────────────────────────────────────────────── */}
      <div id="news-load-more" style={{display:hasMore?'block':'none',textAlign:'center' as const,margin:'20px 0'}}>
        <button className="btn btn-ghost" onClick={() => setPage(p => p+1)}>↓ Tampilkan Lebih Banyak</button>
      </div>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <div style={{marginTop:'24px',padding:'12px 16px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',fontSize:'10px',color:'var(--text3)',lineHeight:'1.7',textAlign:'center' as const}}>
        <strong style={{color:'var(--text2)'}}>ℹ️ Disclaimer:</strong> Berita ini hanya untuk tujuan informasi edukasi. Bukan merupakan saran keuangan atau rekomendasi trading. Selalu lakukan analisis mandiri sebelum mengambil keputusan trading.
      </div>

    </section>
  );
}