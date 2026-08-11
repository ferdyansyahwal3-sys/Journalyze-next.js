// components/journal/PageMonthly.tsx — Phase 8 (pixel-perfect vs index.html)
// Markup + inline style VERBATIM dari index.html renderMonthly() + renderMoCalendar() + renderKesimpulan()
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTradeStore, recalcAll } from '@/store/useTradeStore';
import { liveRates, idrToDisp, fmtDispCur, fmtMoney, type Currency } from '@/lib/riskCalc';

Chart.register(...registerables);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskState() {
  try {
    const s = JSON.parse(localStorage.getItem('jz_state') || 'null');
    return s || { balance: 0, currency: 'IDR' };
  } catch { return { balance: 0, currency: 'IDR' }; }
}

function fmtDate(d: string) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }); }
  catch { return d; }
}

function getMonthKey(tanggal: string) { return tanggal ? tanggal.slice(0, 7) : ''; }

function getISOWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// Verbatim dari index.html getWeekOfMonth — week-of-month untuk label minggu
function getWeekOfMonth(tanggal: string): number {
  if (!tanggal) return 0;
  const d = new Date(tanggal + 'T00:00:00');
  return getISOWeek(d);
}

function getC() {
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    gold:    dark ? '#E8C567' : '#B8882A',
    green:   dark ? '#22C55E' : '#16A34A',
    red:     dark ? '#E84040' : '#DC2626',
    blue:    dark ? '#60A5FA' : '#2563EB',
    grid:    dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    text:    dark ? '#6A6050' : '#8A8070',
    greenBg: dark ? 'rgba(34,197,94,0.12)'  : 'rgba(22,163,74,0.1)',
    redBg:   dark ? 'rgba(232,64,64,0.1)'   : 'rgba(220,38,38,0.08)',
    goldBg:  dark ? 'rgba(201,168,76,0.12)' : 'rgba(154,116,48,0.1)',
    bgColor: dark ? '#0E0E0E' : '#FDFAF4',
  };
}

const PAIR_NAMES = ['XAUUSD', 'USDJPY', 'BTCUSD', 'GBPUSD', 'NASDAQ'];

// Calendar day data type
interface CalDay {
  date: string;
  dayNum: number;
  empty: boolean;
  hasData: boolean;
  profit: number;
  lose: number;
  pl: number;
  tradeCount: number;
  hasDep: boolean;
  hasWd: boolean;
  depAmt: number;
  wdAmt: number;
  isToday: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PageMonthly({ active }: { active: boolean }) {
  const [mounted, setMounted]       = useState(false);
  const [currency, setCurrency]     = useState<Currency>('IDR');
  const [balanceIDR, setBalanceIDR] = useState(0);
  const [fPair,   setFPair]   = useState('');
  const [fSesi,   setFSesi]   = useState('');
  const [fResult, setFResult] = useState('');
  const [fBulan,  setFBulan]  = useState('');
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const { trades, dwList } = useTradeStore();
  const kurs = liveRates.USD_IDR || 16462;

  const refSession = useRef<HTMLCanvasElement>(null);
  const refPair    = useRef<HTMLCanvasElement>(null);
  const refPvl     = useRef<HTMLCanvasElement>(null);
  const refWeekly  = useRef<HTMLCanvasElement>(null);
  const refEquity  = useRef<HTMLCanvasElement>(null);
  const charts     = useRef<Record<string, Chart<any, any[], any>>>({});

  // ── semua hooks di atas early return ──────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    const rs = getRiskState();
    setCurrency((rs.currency || 'IDR') as Currency);
    setBalanceIDR(rs.balance || 0);
  }, []);

  useEffect(() => {
    if (active && mounted) {
      const rs = getRiskState();
      setCurrency((rs.currency || 'IDR') as Currency);
      setBalanceIDR(rs.balance || 0);
    }
  }, [active, mounted]);

  const computedTrades = useMemo(() => {
    if (!mounted) return [];
    return recalcAll(trades, dwList, currency, balanceIDR, kurs);
  }, [mounted, trades, dwList, currency, balanceIDR, kurs]);

  const pairOpts = useMemo(() =>
    [...new Set(computedTrades.map(t => t.pair).filter(Boolean))].sort(),
    [computedTrades]);

  const bulanOpts = useMemo(() =>
    [...new Set(computedTrades.map(t => getMonthKey(t.tanggal)).filter(Boolean))].sort().reverse(),
    [computedTrades]);

  // filtered — semua filter termasuk bulan (untuk stat cards, charts, table, kesimpulan)
  const filtered = useMemo(() => {
    return computedTrades.filter(t => {
      if (fPair   && t.pair   !== fPair)   return false;
      if (fSesi   && t.sesi   !== fSesi)   return false;
      if (fResult && t.result !== fResult) return false;
      if (fBulan  && getMonthKey(t.tanggal) !== fBulan) return false;
      return true;
    });
  }, [computedTrades, fPair, fSesi, fResult, fBulan]);

  const sortedFlt = useMemo(() =>
    [...filtered].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1),
    [filtered]);

  // Stats — verbatim dari setWMStats() di index.html
  const stats = useMemo(() => {
    const sortedAll = [...computedTrades].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1).filter(t => t.result);
    const totalSaldo = sortedAll.length ? (sortedAll[sortedAll.length - 1]._saldo || 0) : idrToDisp(balanceIDR, currency);
    const profit = filtered.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0);
    const lose   = filtered.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0);
    const pl = profit + lose;
    const wins = filtered.filter(t => t.result === 'Profit').length;
    const total = filtered.length;
    const wr = total ? Math.round(wins / total * 100) : 0;
    // Best/worst week — verbatim dari renderMonthly()
    const wkMap: Record<string, number> = {};
    filtered.forEach(t => {
      const key = getMonthKey(t.tanggal) + '-W' + getWeekOfMonth(t.tanggal);
      wkMap[key] = (wkMap[key] || 0) + (t._pl || 0);
    });
    const wks = Object.entries(wkMap);
    const bestWeek  = wks.length ? wks.reduce((a, b) => b[1] > a[1] ? b : a) : null;
    const worstWeek = wks.length ? wks.reduce((a, b) => b[1] < a[1] ? b : a) : null;
    return { profit, lose, pl, totalSaldo, total, wins, losses: total - wins, wr, bestWeek, worstWeek };
  }, [filtered, computedTrades, balanceIDR, currency]);

  // Calendar data — verbatim dari renderMoCalendar()
  const calDays = useMemo((): CalDay[] => {
    const yyyymm = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    // Filter trades untuk kalender (pair/sesi/result saja, TIDAK include fBulan)
    const moTrades = computedTrades.filter(t => {
      if (getMonthKey(t.tanggal) !== yyyymm) return false;
      if (fPair   && t.pair   !== fPair)   return false;
      if (fSesi   && t.sesi   !== fSesi)   return false;
      if (fResult && t.result !== fResult) return false;
      return true;
    });

    // Group by date — verbatim byDate dari renderMoCalendar()
    const byDate: Record<string, { profit: number; lose: number; pl: number; count: number }> = {};
    moTrades.forEach(t => {
      if (!byDate[t.tanggal]) byDate[t.tanggal] = { profit: 0, lose: 0, pl: 0, count: 0 };
      byDate[t.tanggal].pl += (t._pl || 0);
      byDate[t.tanggal].count++;
      if (t.result === 'Profit') byDate[t.tanggal].profit += (t._pl || 0);
      else byDate[t.tanggal].lose += (t._pl || 0);
    });

    // DW by date — verbatim dwByDate dari renderMoCalendar()
    const dwByDate: Record<string, { dep: number; wd: number }> = {};
    dwList.filter(d => !(d as any)._auto && getMonthKey(d.tanggal) === yyyymm).forEach(dw => {
      if (!dwByDate[dw.tanggal]) dwByDate[dw.tanggal] = { dep: 0, wd: 0 };
      let dep = dw.deposit || 0, wd = dw.withdraw || 0;
      if (currency === 'CENT') { dep = (dep / kurs) * 100; wd = (wd / kurs) * 100; }
      else if (currency === 'USD') { dep = dep / kurs; wd = wd / kurs; }
      dwByDate[dw.tanggal].dep += dep;
      dwByDate[dw.tanggal].wd  += wd;
    });

    const days: CalDay[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDow; i++) {
      days.push({ date: '', dayNum: 0, empty: true, hasData: false, profit: 0, lose: 0, pl: 0, tradeCount: 0, hasDep: false, hasWd: false, depAmt: 0, wdAmt: 0, isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yyyymm}-${String(d).padStart(2, '0')}`;
      const dayData = byDate[dateStr];
      const dw      = dwByDate[dateStr];
      days.push({
        date: dateStr, dayNum: d, empty: false,
        hasData: !!(dayData || dw),
        profit: dayData?.profit || 0, lose: dayData?.lose || 0, pl: dayData?.pl || 0,
        tradeCount: dayData?.count || 0,
        hasDep: !!(dw && dw.dep > 0), hasWd: !!(dw && dw.wd > 0),
        depAmt: dw?.dep || 0, wdAmt: dw?.wd || 0,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [computedTrades, dwList, calYear, calMonth, fPair, fSesi, fResult, currency, kurs]);

  // Calendar label — verbatim dari renderMoCalendar()
  const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const calLabel = `${MONTHS_ID[calMonth]} ${calYear}`;

  // Chart destroy helper
  function destroy(key: string) {
    if (charts.current[key]) { charts.current[key].destroy(); delete charts.current[key]; }
  }

  useEffect(() => {
    if (!mounted || !active) return;
    const C = getC();
    const fmtM = (v: number) => fmtMoney(v, currency);

    // Chart 1: Session BAR — verbatim buildSessionPairPVL dari index.html
    destroy('session');
    if (refSession.current) {
      const sNames = ['Asia', 'London', 'US'];
      const sCounts = sNames.map(s => filtered.filter(t => t.sesi === s).length);
      if (sCounts.some(v => v > 0)) {
        charts.current['session'] = new Chart(refSession.current, {
          type: 'bar',
          data: { labels: sNames, datasets: [{ label: 'Trade', data: sCounts, backgroundColor: [C.gold, C.green, C.blue], borderColor: [C.gold, C.green, C.blue], borderWidth: 1.5, borderRadius: 4 }] },
          options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: C.text, font: { size: 9 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} trade` } } },
            scales: { x: { ticks: { color: C.text, font: { size: 8 } }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 8 } }, grid: { color: C.grid } } },
          },
        });
      }
    }

    // Chart 2: Pair Horizontal Bar — verbatim buildSessionPairPVL dari index.html
    destroy('pair');
    if (refPair.current) {
      const pProfit = PAIR_NAMES.map(p => filtered.filter(t => t.pair === p && t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0));
      const pLose   = PAIR_NAMES.map(p => filtered.filter(t => t.pair === p && t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0));
      charts.current['pair'] = new Chart(refPair.current, {
        type: 'bar',
        data: { labels: PAIR_NAMES, datasets: [
          { label: 'Profit', data: pProfit, backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 1.5, borderRadius: 3 },
          { label: 'Lose',   data: pLose,   backgroundColor: C.redBg,   borderColor: C.red,   borderWidth: 1.5, borderRadius: 3 },
        ]},
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
          plugins: { legend: { labels: { color: C.text, font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.x) } } },
          scales: { x: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: C.grid } } },
        },
      });
    }

    // Chart 3: PvL Donut — verbatim buildPieChart dari index.html
    // FIX: new Chart<'doughnut'> supaya TypeScript tahu type-nya dan cutout valid
    destroy('pvl');
    if (refPvl.current) {
      const pvlP = filtered.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0);
      const pvlL = Math.abs(filtered.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0));
      const total = pvlP + pvlL;
      if (total > 0) {
        refPvl.current.width = 130; refPvl.current.height = 130;
        refPvl.current.style.width = '130px'; refPvl.current.style.height = '130px';
        charts.current['pvl'] = new Chart<'doughnut'>(refPvl.current, {
          type: 'doughnut',
          data: { labels: ['Profit', 'Lose'], datasets: [{ data: [pvlP, pvlL], backgroundColor: [C.green, C.red], borderColor: C.bgColor, borderWidth: 2, hoverOffset: 4 }] },
          options: { responsive: false, animation: { duration: 400 }, cutout: '58%',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${Math.round(ctx.parsed / total * 100)}%` } } },
          },
        });
      }
    }

    // Chart 4: P/L per Minggu BAR — verbatim renderMonthly() dari index.html
    destroy('weekly');
    if (refWeekly.current && sortedFlt.length > 0) {
      const wkKeys = [...new Set(sortedFlt.map(t => getMonthKey(t.tanggal) + '-W' + getWeekOfMonth(t.tanggal)))].sort();
      const wkPL = wkKeys.map(k => {
        const [mk, wn] = k.split('-W');
        return sortedFlt.filter(t => getMonthKey(t.tanggal) === mk && String(getWeekOfMonth(t.tanggal)) === wn).reduce((a, t) => a + (t._pl || 0), 0);
      });
      charts.current['weekly'] = new Chart(refWeekly.current, {
        type: 'bar',
        data: { labels: wkKeys, datasets: [{ label: 'P/L Mingguan', data: wkPL, backgroundColor: wkPL.map(v => v >= 0 ? C.greenBg : C.redBg), borderColor: wkPL.map(v => v >= 0 ? C.green : C.red), borderWidth: 1.5, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: C.text, font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.y) } } },
          scales: { x: { ticks: { color: C.text, font: { size: 8 }, maxRotation: 30 }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } } },
        },
      });
    }

    // Chart 5: Equity Curve — verbatim renderMonthly() dari index.html (per hari, bukan per trade)
    destroy('equity');
    if (refEquity.current && sortedFlt.length > 0) {
      const dayMap: Record<string, number> = {};
      sortedFlt.forEach(t => { dayMap[t.tanggal] = (dayMap[t.tanggal] || 0) + (t._pl || 0); });
      const days = Object.keys(dayMap).sort();
      let cum = 0;
      const eqL = days.map(fmtDate);
      const eqD = days.map(d => { cum += dayMap[d]; return cum; });
      const lastVal = eqD[eqD.length - 1] ?? 0;
      charts.current['equity'] = new Chart(refEquity.current, {
        type: 'line',
        data: { labels: eqL, datasets: [{ label: 'Kumulatif P/L', data: eqD, borderColor: lastVal >= 0 ? C.green : C.red, backgroundColor: lastVal >= 0 ? C.greenBg : C.redBg, borderWidth: 2, pointRadius: 3, pointBackgroundColor: eqD.map(v => v >= 0 ? C.green : C.red), fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.y) } } },
          scales: { x: { ticks: { color: C.text, font: { size: 8 }, maxTicksLimit: 12, maxRotation: 0 }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } } },
        },
      });
    }

    return () => { ['session', 'pair', 'pvl', 'weekly', 'equity'].forEach(destroy); };
  }, [mounted, active, sortedFlt, filtered, currency]);

  // ── Helpers render ─────────────────────────────────────────────────────────
  const fmtM = (v: number) => fmtMoney(v, currency);
  const fmt  = (v: number) => fmtDispCur(v, currency);

  const handleBulanChange = (val: string) => {
    setFBulan(val);
    if (val) {
      const [y, m] = val.split('-').map(Number);
      setCalYear(y); setCalMonth(m - 1);
    }
  };

  const resetMonthly = () => {
    setFPair(''); setFSesi(''); setFResult(''); setFBulan('');
    const now = new Date();
    setCalYear(now.getFullYear()); setCalMonth(now.getMonth());
  };

  const calPrev = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const calNext = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // ── Early return (hydration guard) ────────────────────────────────────────
  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-monthly" />;

  // Computed untuk Kesimpulan — verbatim dari renderKesimpulan() di index.html
  const { pl, wins, losses, wr } = stats;
  const plColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
  const wrColor = wr >= 50 ? 'var(--green)' : 'var(--red)';
  const pvlP    = filtered.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0);
  const pvlL    = Math.abs(filtered.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0));
  const pvlTot  = pvlP + pvlL;
  const pf      = pvlL > 0 ? (pvlP / pvlL).toFixed(2) : '∞';
  const pairMap: Record<string, number> = {};
  filtered.forEach(t => { if (t.pair) pairMap[t.pair] = (pairMap[t.pair] || 0) + (t._pl || 0); });
  const bestPair = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0];
  const sesiMap: Record<string, number> = {};
  filtered.forEach(t => { if (t.sesi) sesiMap[t.sesi] = (sesiMap[t.sesi] || 0) + (t._pl || 0); });
  const bestSesi = Object.entries(sesiMap).sort((a, b) => b[1] - a[1])[0];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className={`page${active ? ' active' : ''}`} id="page-monthly">

      {/* PAGE HEADER — verbatim dari index.html */}
      <div className="ph">
        <div>
          <div className="ph-label">📊 Modul 06 — Filter Bulanan</div>
          <h1 className="ph-title">Kalender <em>Trading</em></h1>
          <p className="ph-sub">Rekap performa trading per bulan dalam format kalender.</p>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700, color: 'var(--gold2)', padding: '4px 12px', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)', borderRadius: '6px' }}>
          {currency}
        </span>
      </div>

      {/* FILTER BAR — verbatim dari index.html */}
      <div className="flt-bar">
        <div className="flt-dd-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto' }}>
          <div className="fg">
            <label className="flabel">💱 Pair</label>
            <div className="selwrap">
              <select className="fselect" value={fPair} onChange={e => setFPair(e.target.value)}>
                <option value="">Semua Pair</option>
                {pairOpts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">🌏 Sesi</label>
            <div className="selwrap">
              <select className="fselect" value={fSesi} onChange={e => setFSesi(e.target.value)}>
                <option value="">Semua Sesi</option>
                <option>Asia</option><option>London</option><option>US</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">📊 Result</label>
            <div className="selwrap">
              <select className="fselect" value={fResult} onChange={e => setFResult(e.target.value)}>
                <option value="">Semua</option>
                <option value="Profit">Profit</option>
                <option value="Lose">Lose</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">📅 Bulan</label>
            <div className="selwrap">
              <select className="fselect" value={fBulan} onChange={e => handleBulanChange(e.target.value)}>
                <option value="">Semua Bulan</option>
                {bulanOpts.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button className="btn btn-ghost btn-sm" onClick={resetMonthly} style={{ alignSelf: 'flex-end' }}>↺ Reset</button>
          </div>
        </div>
      </div>

      {/* STATS — verbatim dari index.html */}
      <div className="flt-stats-row">
        <div className="flt-scard green"><div className="flt-scard-lbl">Profit</div><div className="flt-scard-val green">{stats.total ? fmtM(stats.profit) : '—'}</div></div>
        <div className="flt-scard red">  <div className="flt-scard-lbl">Lose</div>  <div className="flt-scard-val red">{stats.total ? fmtM(stats.lose) : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total P-L</div><div className={`flt-scard-val ${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}`}>{stats.total ? fmtM(pl) : '—'}</div></div>
        <div className="flt-scard gold"> <div className="flt-scard-lbl">Total Saldo</div><div className="flt-scard-val gold">{fmtM(stats.totalSaldo)}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total Trade</div><div className="flt-scard-val">{stats.total}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Win Rate</div><div className="flt-scard-val">{stats.total ? wr + '%' : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Best Week</div><div className="flt-scard-val green">{stats.bestWeek ? stats.bestWeek[0] + ' | ' + fmtM(stats.bestWeek[1]) : '—'}</div></div>
        <div className="flt-scard red">  <div className="flt-scard-lbl">Worst Week</div><div className="flt-scard-val red">{stats.worstWeek ? stats.worstWeek[0] + ' | ' + fmtM(stats.worstWeek[1]) : '—'}</div></div>
      </div>

      {/* CALENDAR NAVIGATION — verbatim dari index.html */}
      <div className="box" style={{ marginBottom: '14px' }}>
        <div className="box-head" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn-ghost btn-sm" onClick={calPrev} style={{ padding: '4px 10px' }}>◀</button>
            <div className="box-title" style={{ minWidth: '160px', textAlign: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {calLabel}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={calNext} style={{ padding: '4px 10px' }}>▶</button>
          </div>
          {/* Legenda — verbatim dari index.html */}
          <div style={{ display: 'flex', gap: '10px', fontFamily: "'JetBrains Mono',monospace", fontSize: '8.5px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--green-bg)', border: '1px solid var(--green-bd)' }} /><span style={{ color: 'var(--text3)' }}>Profit</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--red-bg)', border: '1px solid var(--red-bd)' }} /><span style={{ color: 'var(--text3)' }}>Lose</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--blue-bg)', border: '1px solid rgba(96,165,250,0.3)' }} /><span style={{ color: 'var(--text3)' }}>Deposit/WD</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--bg4)', border: '1px solid var(--border2)' }} /><span style={{ color: 'var(--text3)' }}>No Trade</span></div>
          </div>
        </div>

        {/* mo-cal-scroll-wrap + mo-cal-grid — verbatim dari index.html */}
        <div className="mo-cal-scroll-wrap">
          {/* Day headers */}
          <div className="mo-cal-grid" style={{ padding: '0 14px 4px' }}>
            <div className="mo-day-hdr">Sen</div>
            <div className="mo-day-hdr">Sel</div>
            <div className="mo-day-hdr">Rab</div>
            <div className="mo-day-hdr">Kam</div>
            <div className="mo-day-hdr">Jum</div>
            <div className="mo-day-hdr" style={{ color: 'var(--text3)' }}>Sab</div>
            <div className="mo-day-hdr" style={{ color: 'var(--red)' }}>Min</div>
          </div>

          {/* Calendar cells — class verbatim dari renderMoCalendar() di index.html */}
          <div className="mo-cal-grid" style={{ padding: '0 14px 14px' }}>
            {calDays.map((day, i) => {
              if (day.empty) return <div key={`e-${i}`} className="mo-day-cell day-empty" />;

              if (!day.hasData) {
                return (
                  <div key={day.date} className={`mo-day-cell${day.isToday ? ' day-today' : ''}`}>
                    <div className="mo-day-num" style={{ color: 'var(--text4)' }}>{day.dayNum}</div>
                  </div>
                );
              }

              // Tentukan class — verbatim dari renderMoCalendar()
              let cls = 'mo-day-cell has-trade';
              if (day.isToday) cls += ' day-today';
              if (day.tradeCount > 0) {
                if (day.profit > 0 && day.lose === 0)        cls += ' day-profit';
                else if (day.lose < 0 && day.profit === 0)   cls += ' day-lose';
                else if (day.profit > 0 || day.lose < 0)     cls += ' day-mixed';
              } else if (day.hasDep || day.hasWd) {
                cls += '';
              }

              const plSign = day.pl >= 0 ? 'pos' : 'neg';
              const noMoreDW = !day.hasDep && !day.hasWd;
              const hasTradeData = day.tradeCount > 0;

              return (
                <div key={day.date} className={cls} style={(!hasTradeData && (day.hasDep || day.hasWd)) || (hasTradeData && !day.hasDep && !day.hasWd) ? { justifyContent: 'space-between' } : {}}>
                  <div className="mo-day-num">{day.dayNum}</div>
                  <div className="mo-day-cell-body">
                    {hasTradeData && (
                      <div className="mo-day-trade-count">{day.tradeCount} trade</div>
                    )}
                    {hasTradeData && (
                      <div className={`mo-day-pl ${plSign}`} style={noMoreDW ? { marginTop: 'auto' } : {}}>
                        {fmt(day.pl)}
                      </div>
                    )}
                    {day.hasDep && <div className="mo-day-dw dep">+{fmt(day.depAmt)}</div>}
                    {day.hasWd  && <div className="mo-day-dw wd">-{fmt(day.wdAmt)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: Session + Pair + PvL — verbatim dari index.html */}
      <div className="g3" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">🌏 Session Market</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '160px' }}>
            <canvas ref={refSession} />
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">💱 Kontribusi Pair</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '160px' }}>
            <canvas ref={refPair} />
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">📊 P vs L</div></div>
          <div className="box-body" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '18px', minHeight: '160px' }}>
            <div style={{ width: '130px', height: '130px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas ref={refPvl} width={130} height={130} style={{ display: 'block', width: '130px', height: '130px' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '9px', padding: '4px 14px 4px 4px' }}>
              {pvlTot > 0 ? (
                [{ label: 'Profit', val: pvlP, color: 'var(--green)' }, { label: 'Lose', val: pvlL, color: 'var(--red)' }].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: '2px' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, color: 'var(--gold2)' }}>{pvlTot ? Math.round(item.val / pvlTot * 100) : 0}%</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8.5px', color: 'var(--text3)' }}>{fmtM(item.val)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: '11px', padding: '8px' }}>Belum ada data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: P/L Mingguan + Equity — verbatim dari index.html */}
      <div className="g2" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">📆 P/L per Minggu</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '140px' }}>
            <canvas ref={refWeekly} />
          </div>
        </div>
        <div className="box">
          <div className="box-head">
            <div className="box-title">📈 Equity Curve (Kumulatif)</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: 'var(--text3)' }}>Bulan ini</div>
          </div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '140px' }}>
            <canvas ref={refEquity} />
          </div>
        </div>
      </div>

      {/* KESIMPULAN — verbatim dari renderKesimpulan() di index.html */}
      {filtered.length > 0 && (
        <div className="box" style={{ marginBottom: '14px' }}>
          <div className="box-head"><div className="box-title">💡 Kesimpulan Bulanan</div></div>
          <div className="box-body">
            <div style={{ fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Total P/L</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: plColor }}>{fmtM(pl)}</div>
                </div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Win Rate</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: wrColor }}>
                    {wr}%{' '}
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>({wins}W/{losses}L)</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Profit Factor</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: 'var(--gold2)' }}>{pf}</div>
                </div>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.8 }}>
                Dari <strong style={{ color: 'var(--text)' }}>{stats.total} trade</strong> yang difilter,{' '}
                total P/L adalah <strong style={{ color: plColor }}>{fmtM(pl)}</strong>{' '}
                dengan win rate <strong style={{ color: wrColor }}>{wr}%</strong>.{' '}
                {bestPair && <>Pair terbaik: <strong style={{ color: 'var(--gold2)' }}>{bestPair[0]}</strong> ({fmtM(bestPair[1])}).{' '}</>}
                {bestSesi && <>Sesi paling profitable: <strong style={{ color: 'var(--gold2)' }}>{bestSesi[0]}</strong>.{' '}</>}
                {wr >= 60
                  ? <>🔥 <strong>Performa sangat baik!</strong> Pertahankan konsistensi kamu.</>
                  : wr >= 50
                    ? <>✅ Win rate di atas 50%, terus tingkatkan.</>
                    : <>⚠️ <strong>Win rate perlu diperbaiki.</strong> Evaluasi setup dan entry kamu.</>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DATA TABLE — verbatim dari index.html renderWMTable() */}
      <div className="box">
        <div className="box-head">
          <div className="box-title">📋 Data Trading (Terfilter)</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: 'var(--text3)' }}>{filtered.length} trade</div>
        </div>
        <div className="tbl-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>No</th><th>Tanggal</th><th>Bulan</th><th>Minggu</th><th>Sesi</th><th>Pair</th><th>Posisi</th>
                <th>Lot</th><th>Entry</th><th>SL</th><th>TP</th><th>Close</th><th>Result</th>
                <th>Pips</th><th>P/L</th><th>Total Profit</th><th>Total Saldo</th><th>Strategi</th>
              </tr>
            </thead>
            <tbody>
              {sortedFlt.length === 0 ? (
                <tr><td colSpan={18}><div className="ph-empty"><div className="ph-icon">📊</div>Pilih bulan untuk melihat data.</div></td></tr>
              ) : sortedFlt.map((t, i) => {
                const bulan  = t.tanggal ? new Date(t.tanggal + 'T00:00:00').toLocaleString('id-ID', { month: 'long' }) : '—';
                const minggu = t.tanggal ? 'W' + getWeekOfMonth(t.tanggal) : '—';
                const cum    = sortedFlt.slice(0, i + 1).reduce((s, x) => s + (x._pl || 0), 0);
                const metode = (t.metode || t.strategi || '').trim();
                return (
                  <tr key={t.id}>
                    <td className="no">{i + 1}</td>
                    <td className="str">{fmtDate(t.tanggal)}</td>
                    <td style={{ fontSize: '9px', color: 'var(--text3)' }}>{bulan}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', color: 'var(--gold2)', fontWeight: 700 }}>{minggu}</td>
                    <td><span className="chip chip-blue">{t.sesi || '—'}</span></td>
                    <td className="str">{t.pair || '—'}</td>
                    <td><span className={`chip ${t.result === 'Profit' ? 'chip-buy' : 'chip-sell'}`}>{t.posisi || '—'}</span></td>
                    <td>{t.lot || '—'}</td>
                    <td>{t.entry || '—'}</td>
                    <td style={{ color: 'var(--red)', fontSize: '9.5px' }}>{t.sl || '—'}</td>
                    <td style={{ color: 'var(--green)', fontSize: '9.5px' }}>{t.tp || '—'}</td>
                    <td>{t.close || '—'}</td>
                    <td><span className={`chip ${t.result === 'Profit' ? 'chip-profit' : 'chip-lose'}`}>{t.result}</span></td>
                    <td>{t.pips != null ? Math.abs(t.pips).toFixed(2) : '—'}</td>
                    <td className={(t._pl || 0) >= 0 ? 'pos-val' : 'neg-val'}>{t._pl != null ? fmt(t._pl) : '—'}</td>
                    <td className={cum >= 0 ? 'pos-val' : 'neg-val'} style={{ fontSize: '9.5px' }}>{fmt(cum)}</td>
                    <td className="saldo-val" style={{ fontSize: '9.5px' }}>{fmt(t._saldo ?? 0)}</td>
                    <td style={{ minWidth: '90px' }}>
                      {metode ? <span className="chip chip-gold" style={{ fontSize: '7.5px' }}>{metode}</span> : '—'}
                      {t.emosiKontrol && (
                        <div style={{ fontSize: '7.5px', color: t.emosiKontrol === 'Emosi' ? 'var(--red)' : t.emosiKontrol === 'Aman' ? 'var(--green)' : 'var(--blue)', marginTop: '1px' }}>
                          {t.emosiKontrol}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}