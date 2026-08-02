// components/journal/PageNews.tsx
// Phase 9 — Migrasi 1:1 dari index.html section#page-news
// Markup, class names, dan CSS verbatim dari source
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  desc: string;
  url: string;
  source: string;
  time: string;
  category: 'forex' | 'gold' | 'crypto' | 'economic' | 'fed';
  impact: 'high' | 'medium' | 'low';
  emoji: string;
  analysis?: string;
  speculation?: string;
  scenario_bull?: string;
  scenario_bear?: string;
  headline?: string;
  pairs?: string[];
  _isMock?: boolean;
}

interface EconEvent {
  day: string;
  timeWIB: string;
  flag: string;
  name: string;
  forecast: string;
  prev: string;
  actual?: string;
  impact: 'high' | 'medium' | 'low';
}

type NewsCategory = 'all' | 'forex' | 'gold' | 'crypto' | 'economic' | 'fed';
type NewsSort = 'newest' | 'impact';

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    const wib = new Date(d.getTime() + 7 * 3600 * 1000);
    const hh = String(wib.getUTCHours()).padStart(2,'0');
    const mm = String(wib.getUTCMinutes()).padStart(2,'0');
    return `${hh}:${mm} WIB`;
  } catch { return '—'; }
}

function getCatLabel(cat: string): string {
  const map: Record<string, string> = {
    forex: '💱 Forex', gold: '🥇 Gold/XAUUSD',
    crypto: '₿ Crypto', economic: '🏦 Ekonomi', fed: '🇺🇸 Fed/USD',
  };
  return map[cat] || cat;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  return mon.toISOString().split('T')[0];
}

const NEWS_CACHE_KEY = 'jz_news_cache_v2';
const NEWS_CACHE_TTL = 15 * 60 * 1000;
const NEWS_PER_PAGE = 9;
const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ── Mock data fallback ────────────────────────────────────────────────────────
function getMockNews(): NewsItem[] {
  return [
    { title:'Fed Pertahankan Suku Bunga, Fokus pada Data Inflasi', desc:'Federal Reserve mempertahankan suku bunga di 5.25-5.50% sambil mencermati perkembangan inflasi terbaru dan pasar tenaga kerja.', url:'https://www.forexfactory.com/news', source:'ForexFactory', time:new Date(Date.now()-3600000).toISOString(), category:'fed', impact:'high', emoji:'🏦', pairs:['EURUSD','GBPUSD','USDJPY'], _isMock:true },
    { title:'XAUUSD Menguat di Atas $2,300 Didukung Safe Haven', desc:'Harga emas spot naik signifikan dipicu meningkatnya ketidakpastian geopolitik dan pelemahan dolar AS di pasar global.', url:'https://www.dailyfx.com', source:'DailyFX', time:new Date(Date.now()-7200000).toISOString(), category:'gold', impact:'medium', emoji:'🥇', pairs:['XAUUSD'], _isMock:true },
    { title:'EURUSD Uji Resistance 1.0950 Jelang Data CPI Eropa', desc:'Pasangan mata uang EUR/USD bergerak sideways menunggu rilis data inflasi Eropa yang akan menjadi katalis pergerakan berikutnya.', url:'https://www.fxstreet.com', source:'FXStreet', time:new Date(Date.now()-10800000).toISOString(), category:'forex', impact:'medium', emoji:'💱', pairs:['EURUSD'], _isMock:true },
    { title:'BOE Diperkirakan Pangkas Suku Bunga Q3 2024', desc:'Analis memperkirakan Bank of England akan memulai siklus penurunan suku bunga pada kuartal ketiga tahun ini seiring meredanya inflasi.', url:'https://www.forexfactory.com/news', source:'Reuters', time:new Date(Date.now()-14400000).toISOString(), category:'economic', impact:'high', emoji:'📊', pairs:['GBPUSD','GBPJPY'], _isMock:true },
    { title:'USDJPY Tembus 155, BOJ Tetap Pertahankan Kebijakan Ultra-Longgar', desc:'Yen Jepang kembali melemah melewati level psikologis 155 terhadap dolar karena Bank of Japan belum memberi sinyal perubahan kebijakan.', url:'https://www.forexfactory.com/news', source:'Bloomberg', time:new Date(Date.now()-18000000).toISOString(), category:'forex', impact:'high', emoji:'💴', pairs:['USDJPY'], _isMock:true },
    { title:'Bitcoin Konsolidasi di $65,000 Pasca Halving', desc:'Harga Bitcoin bergerak dalam range sempit pasca halving, dengan pelaku pasar menunggu konfirmasi arah tren berikutnya.', url:'https://www.investing.com', source:'Investing.com', time:new Date(Date.now()-21600000).toISOString(), category:'crypto', impact:'low', emoji:'₿', _isMock:true },
  ];
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PageNews({ active }: { active: boolean }) {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [lastFetch, setLastFetch] = useState<number|null>(null);
  const [currentCat, setCurrentCat] = useState<NewsCategory>('all');
  const [sortMode, setSortMode] = useState<NewsSort>('newest');
  const [newsPage, setNewsPage] = useState(1);
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [calTitle, setCalTitle] = useState('📅 ECONOMIC CALENDAR — Minggu Ini');
  const [expandedSpec, setExpandedSpec] = useState<Record<string, boolean>>({});

  const loadingRef = useRef(false);

  // ── Ticker state ─────────────────────────────────────────────────────────────
  const tickerDotColor = state === 'loading' ? 'var(--gold)' : state === 'ok' ? 'var(--green)' : 'var(--text3)';
  const ageStr = lastFetch ? (
    Date.now() - lastFetch < 60000 ? 'baru saja' :
    Date.now() - lastFetch < 3600000 ? Math.round((Date.now()-lastFetch)/60000)+'m lalu' :
    Math.round((Date.now()-lastFetch)/3600000)+'j lalu'
  ) : '—';
  const counts = { forex:0, gold:0, crypto:0, economic:0, fed:0 };
  newsData.forEach(n => { if (counts[n.category] !== undefined) (counts as Record<string,number>)[n.category]++; });

  // ── Load news dari cache atau fetch ──────────────────────────────────────────
  const loadNews = useCallback(async (force = false) => {
    if (loadingRef.current) return;

    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || 'null');
        if (c && (Date.now() - c.ts) < NEWS_CACHE_TTL && c.items?.length) {
          setNewsData(c.items);
          setLastFetch(c.ts);
          setState('ok');
          return;
        }
      } catch { /* ignore */ }
    }

    loadingRef.current = true;
    setLoading(true);
    setState('loading');

    try {
      const res = await fetch('/api/rss-proxy?multi=true');
      const data = await res.json();
      let items: NewsItem[] = data.items ?? [];

      // Kategorisasi otomatis berdasarkan keyword
      items = items.map(item => {
        const t = (item.title + ' ' + (item.desc || '')).toLowerCase();
        let category: NewsItem['category'] = 'forex';
        let impact: NewsItem['impact'] = 'low';
        let pairs: string[] = [];
        let emoji = '📰';

        if (t.match(/gold|xauusd|emas|bullion/)) { category='gold'; emoji='🥇'; }
        else if (t.match(/bitcoin|btc|crypto|ethereum|eth/)) { category='crypto'; emoji='₿'; }
        else if (t.match(/fed|fomc|federal reserve|powell|rate decision/)) { category='fed'; emoji='🏦'; }
        else if (t.match(/gdp|cpi|inflation|pmi|nfp|employment|unemployment|ecb|boe|rba|boj/)) { category='economic'; emoji='📊'; }

        if (t.match(/high impact|rate decision|nfp|fomc|cpi|gdp/)) impact = 'high';
        else if (t.match(/medium|pmi|retail|employment/)) impact = 'medium';

        const pairMatch = (item.title + ' ' + (item.desc||'')).match(/\b(EUR\/USD|GBP\/USD|USD\/JPY|AUD\/USD|USD\/CAD|XAU\/USD|EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|XAUUSD)\b/gi);
        if (pairMatch) pairs = [...new Set(pairMatch.map(p => p.replace('/','').toUpperCase().slice(0,6)))].slice(0,4);

        return { ...item, category, impact, emoji, pairs };
      });

      if (items.length === 0) items = getMockNews();

      const ts = Date.now();
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts, items }));
      setNewsData(items);
      setLastFetch(ts);
      setState('ok');
    } catch {
      if (newsData.length === 0) {
        const mock = getMockNews();
        setNewsData(mock);
      }
      setState('ok');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [newsData.length]);

  // ── Load economic calendar ────────────────────────────────────────────────────
  const loadCalendar = useCallback(async () => {
    setEventsLoading(true);

    // Update judul kalender
    const ws = getWeekStart();
    const mn = new Date(ws + 'T00:00:00Z');
    const fr = new Date(mn); fr.setUTCDate(mn.getUTCDate() + 4);
    setCalTitle(`📅 ECONOMIC CALENDAR — ${mn.getUTCDate()} ${MO[mn.getUTCMonth()]} – ${fr.getUTCDate()} ${MO[fr.getUTCMonth()]} ${fr.getUTCFullYear()}`);

    try {
      const res = await fetch('/api/econ-calendar?week=this');
      const data = await res.json();
      const evs: EconEvent[] = (data.events ?? []).map((ev: { date: string; time: string; currency: string; event: string; forecast: string; previous: string; actual?: string; impact: string }) => {
        const d = new Date(ev.date + 'T00:00:00Z');
        const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
        const flagMap: Record<string, string> = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦', CHF:'🇨🇭', NZD:'🇳🇿', CNY:'🇨🇳' };
        // Convert time to WIB
        let timeWIB = ev.time || 'All Day';
        if (ev.time && ev.time.match(/^\d{2}:\d{2}$/)) {
          try {
            const [h, m] = ev.time.split(':').map(Number);
            const wibH = (h + 7) % 24;
            timeWIB = `${String(wibH).padStart(2,'0')}:${String(m).padStart(2,'0')} WIB`;
          } catch { /* ignore */ }
        }
        return {
          day: days[d.getUTCDay()] || '',
          timeWIB,
          flag: flagMap[ev.currency] || '🌐',
          name: ev.event,
          forecast: ev.forecast || '—',
          prev: ev.previous || '—',
          actual: ev.actual || '',
          impact: (ev.impact as 'high'|'medium'|'low') || 'low',
        };
      });
      setEvents(evs);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // ── Sentiment computation ─────────────────────────────────────────────────────
  const bullWords = ['rally','bullish','gains','rises','higher','strong','surge','breakout','positive','naik','menguat','tembus'];
  const bearWords = ['falls','drops','bearish','weak','decline','crash','negative','koreksi','melemah','tertekan','turun'];
  let bull = 0, bear = 0;
  newsData.forEach(n => {
    const t = (n.title + ' ' + (n.desc||'')).toLowerCase();
    if (bullWords.some(w => t.includes(w))) bull++;
    if (bearWords.some(w => t.includes(w))) bear++;
  });
  const pct = bull + bear > 0 ? Math.round(bull/(bull+bear)*100) : 50;
  const sentiment = pct > 55 ? 'bullish' : pct < 45 ? 'bearish' : 'neutral';
  const sentMap = {
    bullish: { lbl:'Risk-On 📈', col:'var(--green)', icon:'📈' },
    bearish: { lbl:'Risk-Off 📉', col:'var(--red)', icon:'📉' },
    neutral: { lbl:'Mixed ↔️', col:'var(--gold2)', icon:'↔️' },
  };
  const sm = sentMap[sentiment];
  const hiImpact = newsData.filter(n => n.impact==='high').length;
  const goldN = newsData.filter(n => n.category==='gold').length;

  // ── Market speculation mood ──────────────────────────────────────────────────
  const moodLabel = bull > bear ? 'Risk-On 📈 — pasar cenderung bullish' : bear > bull ? 'Risk-Off 📉 — tekanan jual dominan' : 'Mixed ↔️ — sentimen bercampur';
  const moodColor = bull > bear ? 'var(--green)' : bear > bull ? 'var(--red)' : 'var(--gold2)';

  // ── Filtered & sorted news ────────────────────────────────────────────────────
  let filtered = [...newsData];
  if (currentCat !== 'all') filtered = filtered.filter(n => n.category === currentCat);
  if (sortMode === 'impact') {
    const ord: Record<string,number> = { high:0, medium:1, low:2 };
    filtered.sort((a,b) => (ord[a.impact]||1) - (ord[b.impact]||1));
  }
  const shown = filtered.slice(0, newsPage * NEWS_PER_PAGE);
  const hasMore = filtered.length > shown.length;

  const highItems = newsData.filter(n => n.impact==='high').slice(0,2);
  const medItems = newsData.filter(n => n.impact==='medium').slice(0,2);
  const hasSpeculation = highItems.length > 0 || medItems.length > 0;

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (active && state === 'idle') {
      loadNews(false);
      loadCalendar();
    }
  }, [active, state, loadNews, loadCalendar]);

  // ── Reset AI cache ────────────────────────────────────────────────────────────
  const resetAICache = () => {
    localStorage.removeItem(NEWS_CACHE_KEY);
    localStorage.removeItem('jz_news_ai_summary');
    loadNews(true);
    loadCalendar();
  };

  return (
    <section id="page-news" className={`page${active ? ' active' : ''}`}>

      {/* ── Page Header (ph) ─────────────────────────────────────── */}
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
          <button className="btn btn-ghost btn-sm" onClick={resetAICache}>
            🗑 Reset AI Cache
          </button>
        </div>
      </div>

      {/* ── Ticker Status Bar ─────────────────────────────────────── */}
      <div className="ticker ai-anim d1" id="news-ticker-wrap" style={{marginBottom:'20px'}}>
        <div className="ticker-dot" style={{background:tickerDotColor}} />
        <div className="ticker-label">News Feed</div>
        <div className="ticker-items" id="news-ticker-items">
          {state === 'loading' ? (
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'9.5px',color:'var(--text3)'}}>Memuat berita...</span>
          ) : newsData.length > 0 ? (
            <>
              <div className="ticker-item"><span className="ticker-pair">📰 Total</span><span className="ticker-rate">{newsData.length}</span></div>
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

      {/* ── Filter Kategori ──────────────────────────────────────── */}
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
              {(['all','forex','gold','crypto','economic','fed'] as const).map(cat => (
                <div key={cat} className={`chip-opt${currentCat===cat?' sel':''}`} onClick={() => { setCurrentCat(cat); setNewsPage(1); }}>
                  {cat==='all'?'📰 Semua':cat==='forex'?'💱 Forex':cat==='gold'?'🥇 Gold/XAUUSD':cat==='crypto'?'₿ Crypto':cat==='economic'?'🏦 Ekonomi':'🇺🇸 Fed/USD'}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'6px',alignItems:'center',marginLeft:'auto'}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase' as const,color:'var(--text3)'}}>Urutan:</span>
              <div className={`chip-opt${sortMode==='newest'?' sel':''}`} onClick={() => setSortMode('newest')}>Terbaru</div>
              <div className={`chip-opt${sortMode==='impact'?' sel':''}`} onClick={() => setSortMode('impact')}>Impact</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading State ────────────────────────────────────────── */}
      {state === 'loading' && (
        <div id="news-loading">
          <div className="box" style={{marginBottom:'16px'}}>
            <div className="box-body" style={{padding:'40px 20px',textAlign:'center' as const}}>
              <div style={{fontSize:'32px',marginBottom:'14px',animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase' as const,color:'var(--gold2)',marginBottom:'6px'}}>Mengambil berita terkini...</div>
              <div style={{fontSize:'11px',color:'var(--text3)'}}>Sedang menghubungi sumber berita forex global</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sentiment Panel ──────────────────────────────────────── */}
      {state === 'ok' && newsData.length > 0 && (
        <div id="news-sentiment-panel" style={{display:'block'}}>
          <div className="g3 ai-anim d1" style={{marginBottom:'20px'}}>
            <div className={`sentiment-card ${sentiment}`}>
              <div className="sentiment-icon">{sm.icon}</div>
              <div className="sentiment-label">Sentimen Pasar</div>
              <div className="sentiment-value">{sm.lbl}</div>
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
      )}

      {/* ── Economic Calendar ────────────────────────────────────── */}
      {(state === 'ok' || eventsLoading) && (
        <div id="news-events-section" style={{display:'block',marginBottom:'20px'}}>
          <div className="box ai-anim d2">
            <div className="box-head">
              <div className="box-title" dangerouslySetInnerHTML={{__html: calTitle.replace('—','&mdash;').replace(/(\d+ \w+ – \d+ \w+ \d+)/, '<span style="color:var(--gold2)">$1</span>')}} />
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--red)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--red)',display:'inline-block'}} />High</span>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--gold2)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--gold2)',display:'inline-block'}} />Med</span>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'8px',color:'var(--green)'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}} />Low</span>
              </div>
            </div>
            <div className="box-body-0">
              <div id="news-events-list" style={{padding:'4px 0',maxHeight:'497px',overflowY:'auto' as const,scrollbarWidth:'thin' as const}}>
                {eventsLoading ? (
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
                        Forecast: <strong style={{color:'var(--gold2)'}}>{ev.forecast}</strong> · Prev: {ev.prev}
                        {ev.actual && <span style={{marginLeft:'6px',color:'var(--green)',fontWeight:600}}>Actual: {ev.actual}</span>}
                      </div>
                    </div>
                    <div className={`event-impact-dot ${ev.impact}`} title={`${ev.impact} impact`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Kesimpulan & Spekulasi AI ─────────────────────────────── */}
      {state === 'ok' && hasSpeculation && (
        <div id="news-speculation-section" style={{display:'block',marginBottom:'20px'}}>
          <div className="box ai-anim d2">
            <div className="box-head">
              <div className="box-title">📊 Kesimpulan &amp; Spekulasi AI</div>
              <span id="news-spec-mood" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'9px',padding:'5px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',color:moodColor}}>
                Overall: {moodLabel}
              </span>
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
                      const sid = `h${i}`;
                      const isLast = i === highItems.length - 1 && medItems.length === 0;
                      return (
                        <div key={sid} className={`spec-item${isLast?' spec-item-last':''}`}>
                          <div className="spec-item-header">
                            <span className={`news-card-cat ${n.category}`}>{getCatLabel(n.category)}</span>
                            <span className={`news-card-impact ${n.impact}`}>{n.impact==='high'?'🔴 High':n.impact==='medium'?'🟡 Medium':'🟢 Low'}</span>
                            {n.pairs?.slice(0,3).map(p => <span key={p} className="chip chip-gold" style={{fontSize:'8px'}}>{p}</span>)}
                            {n.source && <span className="spec-source">{n.source}</span>}
                          </div>
                          <div className="spec-news-title">{n.title}</div>
                          {n.analysis || n.speculation ? (
                            <>
                              {!expandedSpec[sid] ? (
                                <div className="spec-preview">
                                  {n.desc || n.analysis?.slice(0,120) || ''}
                                  <button className="spec-readmore" onClick={() => setExpandedSpec(p => ({...p,[sid]:true}))}>▾ Baca selengkapnya</button>
                                </div>
                              ) : (
                                <div className="spec-full">
                                  {n.analysis && <div className="spec-analysis-full">{n.analysis}</div>}
                                  {n.scenario_bear && <div className="spec-scenario bear"><span>🔴 Bearish:</span> {n.scenario_bear}</div>}
                                  {n.scenario_bull && <div className="spec-scenario bull"><span>🟢 Bullish:</span> {n.scenario_bull}</div>}
                                  {n.speculation && <div className="spec-analysis"><span className="spec-badge spekulasi">🎯 Bias</span><span>{n.speculation}</span></div>}
                                  <button className="spec-readmore" style={{marginTop:'6px'}} onClick={() => setExpandedSpec(p => ({...p,[sid]:false}))}>▴ Sembunyikan</button>
                                </div>
                              )}
                            </>
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
                      const sid = `m${i}`;
                      const isLast = i === medItems.length - 1;
                      return (
                        <div key={sid} className={`spec-item${isLast?' spec-item-last':''}`}>
                          <div className="spec-item-header">
                            <span className={`news-card-cat ${n.category}`}>{getCatLabel(n.category)}</span>
                            <span className={`news-card-impact ${n.impact}`}>{n.impact==='high'?'🔴 High':n.impact==='medium'?'🟡 Medium':'🟢 Low'}</span>
                            {n.pairs?.slice(0,3).map(p => <span key={p} className="chip chip-gold" style={{fontSize:'8px'}}>{p}</span>)}
                            {n.source && <span className="spec-source">{n.source}</span>}
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
      )}

      {/* ── News Cards Grid ──────────────────────────────────────── */}
      <div id="news-cards-container">
        {state === 'idle' || (state === 'loading' && newsData.length === 0) ? (
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
              const featured = i === 0 && currentCat === 'all';
              const destUrl = (n.url && n.url !== '#') ? n.url : 'https://www.forexfactory.com/news';
              return (
                <div
                  key={i}
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
                      src={n.thumbnail}
                      alt=""
                      className="news-card-img"
                      loading="lazy"
                      onError={e => {
                        const t = e.currentTarget;
                        t.style.display = 'none';
                        const ph = document.createElement('div');
                        ph.className = 'news-card-img-placeholder';
                        ph.textContent = n.emoji || '📰';
                        t.parentNode?.insertBefore(ph, t);
                      }}
                    />
                  ) : (
                    <div className="news-card-img-placeholder">{n.emoji || '📰'}</div>
                  )}
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <span className="news-card-source">{n.source}</span>
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

      {/* ── Load More ─────────────────────────────────────────────── */}
      {hasMore && (
        <div id="news-load-more" style={{display:'block',textAlign:'center' as const,margin:'20px 0'}}>
          <button className="btn btn-ghost" onClick={() => setNewsPage(p => p+1)} id="news-load-more-btn">
            ↓ Tampilkan Lebih Banyak
          </button>
        </div>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div style={{marginTop:'24px',padding:'12px 16px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',fontSize:'10px',color:'var(--text3)',lineHeight:'1.7',textAlign:'center' as const}}>
        <strong style={{color:'var(--text2)'}}>ℹ️ Disclaimer:</strong> Berita ini hanya untuk tujuan informasi edukasi. Bukan merupakan saran keuangan atau rekomendasi trading. Selalu lakukan analisis mandiri sebelum mengambil keputusan trading.
      </div>

    </section>
  );
}