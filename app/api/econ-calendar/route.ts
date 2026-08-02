import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
};

function getWeekDates() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  return { mon, fri: new Date(mon.getTime() + 4 * 86400000) };
}

function getMockCalendar() {
  const { mon } = getWeekDates();
  const days = ['Sen','Sel','Rab','Kam','Jum'];
  const flags: Record<string, string> = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦' };
  const raw = [
    { d:0, time:'01:00', cur:'USD', name:'Federal Funds Rate', forecast:'3.75%', prev:'3.75%', impact:'high' },
    { d:0, time:'01:00', cur:'USD', name:'FOMC Statement', forecast:'—', prev:'—', impact:'high' },
    { d:0, time:'01:30', cur:'USD', name:'FOMC Press Conference', forecast:'—', prev:'—', impact:'high' },
    { d:1, time:'13:29', cur:'EUR', name:'German Prelim CPI m/m', forecast:'0.7%', prev:'-0.3%', impact:'medium' },
    { d:1, time:'15:00', cur:'EUR', name:'German Prelim GDP q/q', forecast:'0.1%', prev:'0.3%', impact:'medium' },
    { d:1, time:'18:00', cur:'GBP', name:'BOE Monetary Policy Report', forecast:'—', prev:'—', impact:'high' },
    { d:2, time:'02:30', cur:'AUD', name:'Retail Sales m/m', forecast:'0.3%', prev:'0.5%', impact:'medium' },
    { d:2, time:'14:30', cur:'USD', name:'Unemployment Claims', forecast:'220K', prev:'218K', impact:'medium' },
    { d:3, time:'15:30', cur:'USD', name:'Non-Farm Employment Change', forecast:'175K', prev:'147K', impact:'high' },
    { d:3, time:'15:30', cur:'USD', name:'Unemployment Rate', forecast:'4.2%', prev:'4.1%', impact:'high' },
    { d:4, time:'09:00', cur:'EUR', name:'French Prelim CPI m/m', forecast:'0.2%', prev:'-0.1%', impact:'low' },
  ];
  return raw.map((ev, i) => {
    const date = new Date(mon.getTime() + ev.d * 86400000);
    const [h, m] = ev.time.split(':').map(Number);
    const wibH = (h + 7) % 24;
    return {
      id: `mock-${i}`,
      date: date.toISOString().split('T')[0],
      day: days[ev.d] || '',
      timeWIB: `${String(wibH).padStart(2,'0')}:${String(m).padStart(2,'0')} WIB`,
      flag: flags[ev.cur] || '🌐',
      currency: ev.cur,
      name: ev.name,
      forecast: ev.forecast,
      prev: ev.prev,
      actual: '',
      impact: ev.impact as 'high' | 'medium' | 'low',
    };
  });
}

async function fetchForexFactory(week: string) {
  const url = week === 'next'
    ? 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'
    : 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Journalyze/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Array<{
    title: string; country: string; date: string;
    time: string; impact: string; forecast: string; previous: string; actual: string;
  }>;

  const flagMap: Record<string, string> = {
    USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺',
    CAD:'🇨🇦', CHF:'🇨🇭', NZD:'🇳🇿', CNY:'🇨🇳',
  };
  const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const impactMap: Record<string, 'high'|'medium'|'low'> = {
    'High':'high', 'Medium':'medium', 'Low':'low',
    'high':'high', 'medium':'medium', 'low':'low',
  };

  return data.map((ev, i) => {
    const d = new Date(ev.date);
    let timeWIB = ev.time || 'All Day';
    if (ev.time && /^\d{1,2}:\d{2}(am|pm)$/i.test(ev.time)) {
      try {
        const t = new Date(`1970-01-01 ${ev.time}`);
        const wibH = (t.getUTCHours() + 7) % 24;
        timeWIB = `${String(wibH).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')} WIB`;
      } catch { /* keep as-is */ }
    }
    return {
      id: `ff-${i}`,
      date: d.toISOString().split('T')[0],
      day: days[d.getDay()] || '',
      timeWIB,
      flag: flagMap[ev.country] || '🌐',
      currency: ev.country,
      name: ev.title,
      forecast: ev.forecast || '—',
      prev: ev.previous || '—',
      actual: ev.actual || '',
      impact: impactMap[ev.impact] || 'low',
    };
  });
}

export async function GET(request: NextRequest) {
  const week = new URL(request.url).searchParams.get('week') ?? 'this';
  try {
    const events = await fetchForexFactory(week);
    const { mon, fri } = getWeekDates();
    const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const title = `📅 ECONOMIC CALENDAR — ${mon.getUTCDate()} ${MO[mon.getUTCMonth()]} – ${fri.getUTCDate()} ${MO[fri.getUTCMonth()]} ${fri.getUTCFullYear()}`;
    return NextResponse.json({ events, source: 'forexfactory', week, title }, { headers: corsHeaders });
  } catch (err) {
    const events = getMockCalendar();
    const { mon, fri } = getWeekDates();
    const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const title = `📅 ECONOMIC CALENDAR — ${mon.getUTCDate()} ${MO[mon.getUTCMonth()]} – ${fri.getUTCDate()} ${MO[fri.getUTCMonth()]} ${fri.getUTCFullYear()}`;
    return NextResponse.json({
      events, source: 'mock', week, title,
      warning: `Upstream gagal (${err instanceof Error ? err.message : 'error'}) — data simulasi`,
    }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
