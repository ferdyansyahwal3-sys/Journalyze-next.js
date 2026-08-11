// components/journal/PageWeekly.tsx — Phase 8 (pixel-perfect vs index.html)
// Markup + inline style VERBATIM dari index.html renderWeekly() & renderKesimpulan()
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

function getISOWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getWeekLabel(d: Date) { return `W${getISOWeek(d)}-${d.getFullYear()}`; }

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1 + offset * 7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

function getMonthRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function PageWeekly({ active }: { active: boolean }) {
  const [mounted, setMounted]       = useState(false);
  const [currency, setCurrency]     = useState<Currency>('IDR');
  const [balanceIDR, setBalanceIDR] = useState(0);
  const [fPair,    setFPair]    = useState('');
  const [fSesi,    setFSesi]    = useState('');
  const [fResult,  setFResult]  = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const { trades, dwList } = useTradeStore();
  const kurs = liveRates.USD_IDR || 16462;

  const refSession = useRef<HTMLCanvasElement>(null);
  const refPair    = useRef<HTMLCanvasElement>(null);
  const refPvl     = useRef<HTMLCanvasElement>(null);
  const refDaily   = useRef<HTMLCanvasElement>(null);
  const refStrat   = useRef<HTMLCanvasElement>(null);
  const refEquity  = useRef<HTMLCanvasElement>(null);
  const charts     = useRef<Record<string, Chart<any, any[], any>>>({});

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

  const filtered = useMemo(() => {
    return computedTrades.filter(t => {
      if (fPair   && t.pair   !== fPair)   return false;
      if (fSesi   && t.sesi   !== fSesi)   return false;
      if (fResult && t.result !== fResult) return false;
      if (dateFrom && t.tanggal < dateFrom) return false;
      if (dateTo   && t.tanggal > dateTo)   return false;
      return true;
    });
  }, [computedTrades, fPair, fSesi, fResult, dateFrom, dateTo]);

  const sortedFlt = useMemo(() =>
    [...filtered].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1),
    [filtered]);

  const stats = useMemo(() => {
    const wins   = filtered.filter(t => t.result === 'Profit');
    const losses = filtered.filter(t => t.result === 'Lose');
    const profit = wins.reduce((s, t) => s + (t._pl || 0), 0);
    const lose   = losses.reduce((s, t) => s + (t._pl || 0), 0);
    const pl     = profit + lose;
    const sortedAll = [...computedTrades].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1).filter(t => t.result);
    const totalSaldo = sortedAll.length ? (sortedAll[sortedAll.length - 1]._saldo || 0) : idrToDisp(balanceIDR, currency);
    const wr = filtered.length ? Math.round((wins.length / filtered.length) * 100) : 0;
    const dayMap: Record<string, number> = {};
    filtered.forEach(t => { dayMap[t.tanggal] = (dayMap[t.tanggal] || 0) + (t._pl || 0); });
    const days = Object.entries(dayMap);
    const bestDay  = days.length ? days.reduce((a, b) => b[1] > a[1] ? b : a) : null;
    const worstDay = days.length ? days.reduce((a, b) => b[1] < a[1] ? b : a) : null;
    return { profit, lose, pl, totalSaldo, total: filtered.length, wins: wins.length, losses: losses.length, wr, bestDay, worstDay };
  }, [filtered, computedTrades, balanceIDR, currency]);

  function destroy(key: string) {
    if (charts.current[key]) { charts.current[key].destroy(); delete charts.current[key]; }
  }

  useEffect(() => {
    if (!mounted || !active) return;
    const C = getC();
    const fmtM = (v: number) => fmtMoney(v, currency);

    // Chart 1: Session BAR
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

    // Chart 2: Pair Horizontal Bar
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

    // Chart 3: PvL Donut
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

    // Chart 4: P/L per Hari BAR
    destroy('daily');
    if (refDaily.current && sortedFlt.length > 0) {
      const dayMap: Record<string, number> = {};
      sortedFlt.forEach(t => { dayMap[t.tanggal] = (dayMap[t.tanggal] || 0) + (t._pl || 0); });
      const days = Object.keys(dayMap).sort();
      const dayPL = days.map(d => dayMap[d]);
      charts.current['daily'] = new Chart(refDaily.current, {
        type: 'bar',
        data: { labels: days.map(fmtDate), datasets: [{ label: 'P/L Harian', data: dayPL, backgroundColor: dayPL.map(v => v >= 0 ? C.greenBg : C.redBg), borderColor: dayPL.map(v => v >= 0 ? C.green : C.red), borderWidth: 1.5, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.y) } } },
          scales: { x: { ticks: { color: C.text, font: { size: 8 }, maxRotation: 0 }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } } },
        },
      });
    }

    // Chart 5: Strategi Horizontal Bar
    destroy('strat');
    if (refStrat.current && sortedFlt.length > 0) {
      const stratMap: Record<string, { profit: number; lose: number }> = {};
      sortedFlt.forEach(t => {
        const strats = (t.strategi || t.metode || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        strats.forEach((s: string) => {
          if (!stratMap[s]) stratMap[s] = { profit: 0, lose: 0 };
          if (t.result === 'Profit') stratMap[s].profit += (t._pl || 0);
          else stratMap[s].lose += (t._pl || 0);
        });
      });
      const labels = Object.keys(stratMap).sort((a, b) => (stratMap[b].profit + stratMap[b].lose) - (stratMap[a].profit + stratMap[a].lose));
      if (labels.length > 0) {
        charts.current['strat'] = new Chart(refStrat.current, {
          type: 'bar',
          data: { labels, datasets: [
            { label: 'Profit', data: labels.map(s => stratMap[s].profit), backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 1.5, borderRadius: 3 },
            { label: 'Lose',   data: labels.map(s => stratMap[s].lose),   backgroundColor: C.redBg,   borderColor: C.red,   borderWidth: 1.5, borderRadius: 3 },
          ]},
          options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
            plugins: { legend: { labels: { color: C.text, font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.x) } } },
            scales: { x: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: C.grid } } },
          },
        });
      }
    }

    // Chart 6: Equity Curve
    destroy('equity');
    if (refEquity.current && sortedFlt.length > 0) {
      const isSingleDay = dateFrom && dateTo && dateFrom === dateTo;
      let eqLabels: string[], eqData: number[];
      if (isSingleDay) {
        let cum = 0;
        eqLabels = sortedFlt.map((_, i) => `#${i + 1}`);
        eqData   = sortedFlt.map(t => { cum += (t._pl || 0); return cum; });
      } else {
        const dayMap: Record<string, number> = {};
        sortedFlt.forEach(t => { dayMap[t.tanggal] = (dayMap[t.tanggal] || 0) + (t._pl || 0); });
        const days = Object.keys(dayMap).sort();
        let cum = 0;
        eqLabels = days.map(fmtDate);
        eqData   = days.map(d => { cum += dayMap[d]; return cum; });
      }
      const lastVal   = eqData[eqData.length - 1] ?? 0;
      const eqColor   = lastVal >= 0 ? C.green : C.red;
      const eqColorBg = lastVal >= 0 ? C.greenBg : C.redBg;
      charts.current['equity'] = new Chart(refEquity.current, {
        type: 'line',
        data: { labels: eqLabels, datasets: [{ label: 'Kumulatif P/L', data: eqData, borderColor: eqColor, backgroundColor: eqColorBg, borderWidth: 2, pointRadius: isSingleDay ? 3 : 2, pointBackgroundColor: eqData.map(v => v >= 0 ? C.green : C.red), fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtM(ctx.parsed.y) } } },
          scales: { x: { ticks: { color: C.text, font: { size: 8 }, maxTicksLimit: isSingleDay ? 20 : 12, maxRotation: isSingleDay ? 45 : 0 }, grid: { color: C.grid } }, y: { ticks: { color: C.text, font: { size: 8 }, callback: v => fmtM(Number(v)) }, grid: { color: C.grid } } },
        },
      });
    }

    return () => { ['session', 'pair', 'pvl', 'daily', 'strat', 'equity'].forEach(destroy); };
  }, [mounted, active, sortedFlt, filtered, currency, dateFrom, dateTo]);

  // ── Helpers render ─────────────────────────────────────────────────────────
  const fmtM = (v: number) => fmtMoney(v, currency);
  const fmt  = (v: number) => fmtDispCur(v, currency);

  const resetWeekly = () => { setFPair(''); setFSesi(''); setFResult(''); setDateFrom(''); setDateTo(''); };
  const setRange = (offset: number | 'month') => {
    if (offset === 'month') { const r = getMonthRange(); setDateFrom(r.from); setDateTo(r.to); }
    else { const r = getWeekRange(offset); setDateFrom(r.from); setDateTo(r.to); }
  };

  // ── Early return (hydration guard) ────────────────────────────────────────
  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-weekly" />;

  // Computed values untuk Kesimpulan & PvL legend
  const pvlP     = filtered.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0);
  const pvlL     = Math.abs(filtered.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0));
  const pvlTotal = pvlP + pvlL;

  const { pl, wins: winsCount, losses: lossesCount, wr } = stats;
  const plColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
  const wrColor = wr >= 50 ? 'var(--green)' : 'var(--red)';
  const pf      = pvlL > 0 ? (pvlP / pvlL).toFixed(2) : '∞';

  const pairMap: Record<string, number> = {};
  filtered.forEach(t => { if (t.pair) pairMap[t.pair] = (pairMap[t.pair] || 0) + (t._pl || 0); });
  const bestPair = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0];

  const sesiMap: Record<string, number> = {};
  filtered.forEach(t => { if (t.sesi) sesiMap[t.sesi] = (sesiMap[t.sesi] || 0) + (t._pl || 0); });
  const bestSesi = Object.entries(sesiMap).sort((a, b) => b[1] - a[1])[0];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className={`page${active ? ' active' : ''}`} id="page-weekly">

      {/* PAGE HEADER */}
      <div className="ph">
        <div>
          <div className="ph-label">📆 Modul 05 — Filter Mingguan</div>
          <h1 className="ph-title">Performa <em>Mingguan</em></h1>
          <p className="ph-sub">Analisis performa trading berdasarkan rentang tanggal.</p>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700, color: 'var(--gold2)', padding: '4px 12px', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)', borderRadius: '6px' }}>
          {currency}
        </span>
      </div>

      {/* FILTER BAR */}
      <div className="flt-bar">
        <div className="flt-dd-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto' }}>
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
            <label className="flabel">📅 Dari Tanggal</label>
            <input type="date" className="finput" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="fg">
            <label className="flabel">📅 Sampai Tanggal</label>
            <input type="date" className="finput" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button className="btn btn-ghost btn-sm" onClick={resetWeekly} style={{ alignSelf: 'flex-end' }}>↺ Reset</button>
          </div>
        </div>
        {/* Quick week shortcuts */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', flexShrink: 0 }}>Pintas:</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setRange(0)}       style={{ padding: '3px 9px', fontSize: '10px' }}>Minggu Ini</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRange(-1)}      style={{ padding: '3px 9px', fontSize: '10px' }}>Minggu Lalu</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRange(-2)}      style={{ padding: '3px 9px', fontSize: '10px' }}>2 Minggu Lalu</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRange('month')} style={{ padding: '3px 9px', fontSize: '10px' }}>Bulan Ini</button>
        </div>
      </div>

      {/* STATS */}
      <div className="flt-stats-row">
        <div className="flt-scard green"><div className="flt-scard-lbl">Profit</div><div className="flt-scard-val green">{stats.total ? fmtM(stats.profit) : '—'}</div></div>
        <div className="flt-scard red">  <div className="flt-scard-lbl">Lose</div>  <div className="flt-scard-val red">{stats.total ? fmtM(stats.lose) : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total P-L</div><div className={`flt-scard-val ${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}`}>{stats.total ? fmtM(pl) : '—'}</div></div>
        <div className="flt-scard gold"> <div className="flt-scard-lbl">Total Saldo</div><div className="flt-scard-val gold">{fmtM(stats.totalSaldo)}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total Trade</div><div className="flt-scard-val">{stats.total}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Win Rate</div><div className="flt-scard-val">{stats.total ? wr + '%' : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Best Day</div><div className="flt-scard-val green">{stats.bestDay ? fmtDate(stats.bestDay[0]) + ' | ' + fmtM(stats.bestDay[1]) : '—'}</div></div>
        <div className="flt-scard red">  <div className="flt-scard-lbl">Worst Day</div><div className="flt-scard-val red">{stats.worstDay ? fmtDate(stats.worstDay[0]) + ' | ' + fmtM(stats.worstDay[1]) : '—'}</div></div>
      </div>

      {/* ROW 1: Session + Pair + PvL */}
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
              {pvlTotal > 0 ? (
                [{ label: 'Profit', val: pvlP, color: 'var(--green)' }, { label: 'Lose', val: pvlL, color: 'var(--red)' }].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: '2px' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, color: 'var(--gold2)' }}>{pvlTotal ? Math.round(item.val / pvlTotal * 100) : 0}%</div>
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

      {/* ROW 2: P/L Harian + Strategi */}
      <div className="g2" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">📅 P/L per Hari</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '150px' }}>
            <canvas ref={refDaily} />
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">🎯 Performa per Strategi</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '150px' }}>
            <canvas ref={refStrat} />
          </div>
        </div>
      </div>

      {/* ROW 3: Equity Curve */}
      <div className="box" style={{ marginBottom: '14px' }}>
        <div className="box-head">
          <div className="box-title">📈 Equity Curve (P/L Kumulatif)</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: 'var(--text3)' }}>Rentang yang dipilih</div>
        </div>
        <div className="box-body" style={{ padding: '14px 16px', minHeight: '130px' }}>
          <canvas ref={refEquity} />
        </div>
      </div>

      {/* KESIMPULAN */}
      {filtered.length > 0 && (
        <div className="box" style={{ marginBottom: '14px' }}>
          <div className="box-head"><div className="box-title">💡 Kesimpulan Mingguan</div></div>
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
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>({winsCount}W/{lossesCount}L)</span>
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

      {/* DATA TABLE */}
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
                <tr><td colSpan={18}><div className="ph-empty"><div className="ph-icon">📆</div>Pilih rentang tanggal untuk melihat data.</div></td></tr>
              ) : sortedFlt.map((t, i) => {
                const bulan  = t.tanggal ? new Date(t.tanggal + 'T00:00:00').toLocaleString('id-ID', { month: 'long' }) : '—';
                const minggu = t.tanggal ? getWeekLabel(new Date(t.tanggal + 'T00:00:00')) : '—';
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