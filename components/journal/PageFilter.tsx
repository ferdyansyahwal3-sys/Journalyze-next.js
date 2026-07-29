// components/journal/PageFilter.tsx — Phase 7
// Markup 1:1 dengan index.html section #page-filter
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTradeStore, recalcAll } from '@/store/useTradeStore';
import { liveRates, idrToDisp, fmtDispCur, fmtMoney, type Currency } from '@/lib/riskCalc';
import type { Trade } from '@/lib/types';

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

function calcStreak(trades: Trade[], type: 'Profit' | 'Lose') {
  let max = 0, cur = 0;
  for (const t of trades) {
    if (t.result === type) { cur++; max = Math.max(max, cur); } else cur = 0;
  }
  return max;
}

const STRATEGI_CHIPS = [
  { v: '', l: 'Semua' },
  { v: 'SND', l: 'SND' }, { v: 'SNR', l: 'SNR' }, { v: 'SMC', l: 'SMC' },
  { v: 'ICT', l: 'ICT' }, { v: 'ELMETHOD', l: 'EL' }, { v: 'ALCHEMIST', l: 'ALCH' },
  { v: 'FIBONACCI', l: 'FIB' }, { v: 'DOJI', l: 'DOJI' }, { v: 'IKUT ALUR', l: 'ALUR' },
  { v: 'BE+', l: 'BE+' }, { v: 'SINYAL', l: 'SINYAL' }, { v: 'TRENDLINE', l: 'TREND' },
  { v: 'HIGH RISK', l: 'HR' }, { v: 'TDK DICATAT', l: 'TDK' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PageFilter({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState<Currency>('IDR');
  const [balanceIDR, setBalanceIDR] = useState(0);

  const [fPair, setFPair] = useState('');
  const [fSesi, setFSesi] = useState('');
  const [fResult, setFResult] = useState('');
  const [fStrategi, setFStrategi] = useState<string[]>([]);

  const { trades, dwList } = useTradeStore();
  const kurs = liveRates.USD_IDR || 16462;

  const chartPvSaldoRef = useRef<HTMLCanvasElement>(null);
  const chartSessionRef = useRef<HTMLCanvasElement>(null);
  const chartDailyRef   = useRef<HTMLCanvasElement>(null);
  const chartPairRef    = useRef<HTMLCanvasElement>(null);
  const chartInstances  = useRef<Record<string, Chart>>({});

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

  const filtered = useMemo(() => {
    return computedTrades.filter(t => {
      if (fPair && t.pair !== fPair) return false;
      if (fSesi && t.sesi !== fSesi) return false;
      if (fResult && t.result !== fResult) return false;
      if (fStrategi.length > 0) {
        const tradeStrats = (t.metode || t.strategi || '').split(',').map(s => s.trim());
        const hasMatch = fStrategi.some(sel => tradeStrats.includes(sel));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [computedTrades, fPair, fSesi, fResult, fStrategi]);

  const sortedFlt = useMemo(() =>
    [...filtered].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1),
    [filtered]);

  const stats = useMemo(() => {
    const wins   = filtered.filter(t => t.result === 'Profit');
    const losses = filtered.filter(t => t.result === 'Lose');
    const totalProfit = wins.reduce((s, t) => s + (t._pl || 0), 0);
    const totalLose   = losses.reduce((s, t) => s + (t._pl || 0), 0);
    const totalPL     = totalProfit + totalLose;
    const sortedAll   = [...computedTrades].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1).filter(t => t.result);
    const totalSaldo  = sortedAll.length ? (sortedAll[sortedAll.length - 1]._saldo || 0) : idrToDisp(balanceIDR, currency);
    const dwTotal     = dwList.filter(d => !d._auto).reduce((s, d) => s + idrToDisp(d.deposit || 0, currency) - idrToDisp(d.withdraw || 0, currency), 0);
    const wr   = filtered.length ? (wins.length / filtered.length) * 100 : 0;
    const avgPL = filtered.length ? totalPL / filtered.length : 0;
    const pf   = totalLose !== 0 ? Math.abs(totalProfit / totalLose) : 0;
    return {
      totalProfit, totalLose, totalPL, totalSaldo, dwTotal,
      total: filtered.length, wins: wins.length, losses: losses.length,
      wr, avgPL, pf,
      winStreak:  calcStreak(filtered, 'Profit'),
      lossStreak: calcStreak(filtered, 'Lose'),
    };
  }, [filtered, computedTrades, balanceIDR, currency, dwList]);

  const sesiData = useMemo(() => {
    const base = computedTrades.filter(t => {
      if (fPair && t.pair !== fPair) return false;
      if (fResult && t.result !== fResult) return false;
      if (fStrategi.length > 0) {
        const tradeStrats = (t.metode || t.strategi || '').split(',').map(s => s.trim());
        return fStrategi.some(sel => tradeStrats.includes(sel));
      }
      return true;
    });
    return ['Asia', 'London', 'US'].map(s => {
      const st = base.filter(t => t.sesi === s);
      return {
        session: s, total: st.length,
        profit: st.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0),
        lose:   st.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0),
      };
    });
  }, [computedTrades, fPair, fResult, fStrategi]);

  const pairData = useMemo(() => {
    const base = computedTrades.filter(t => {
      if (fSesi && t.sesi !== fSesi) return false;
      if (fResult && t.result !== fResult) return false;
      if (fStrategi.length > 0) {
        const tradeStrats = (t.metode || t.strategi || '').split(',').map(s => s.trim());
        return fStrategi.some(sel => tradeStrats.includes(sel));
      }
      return true;
    });
    const allPairs = [...new Set(computedTrades.map(t => t.pair).filter(Boolean))].sort();
    return allPairs.map(p => {
      const pt = base.filter(t => t.pair === p);
      return {
        pair: p, total: pt.length,
        profit: pt.filter(t => t.result === 'Profit').reduce((a, t) => a + (t._pl || 0), 0),
        lose:   pt.filter(t => t.result === 'Lose').reduce((a, t) => a + (t._pl || 0), 0),
      };
    });
  }, [computedTrades, fSesi, fResult, fStrategi]);

  const pairOpts = useMemo(() =>
    [...new Set(computedTrades.map(t => t.pair).filter(Boolean))].sort(),
    [computedTrades]);

  // ── Charts ────────────────────────────────────────────────────────────────

  function destroyChart(key: string) {
    if (chartInstances.current[key]) {
      chartInstances.current[key].destroy();
      delete chartInstances.current[key];
    }
  }

  useEffect(() => {
    if (!mounted || !active) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const C = {
      grid:    isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      text:    isDark ? '#6A6050' : '#8A8070',
      gold:    isDark ? '#E8C567' : '#B8882A',
      green:   isDark ? '#22C55E' : '#16A34A',
      red:     isDark ? '#E84040' : '#DC2626',
      blue:    isDark ? '#60A5FA' : '#2563EB',
      greenBg: isDark ? 'rgba(34,197,94,0.12)'  : 'rgba(22,163,74,0.1)',
      goldBg:  isDark ? 'rgba(201,168,76,0.12)' : 'rgba(154,116,48,0.1)',
      redBg:   isDark ? 'rgba(232,64,64,0.1)'   : 'rgba(220,38,38,0.08)',
      bgColor: isDark ? '#0E0E0E' : '#FDFAF4',
    };
    const fontOpts = { family: 'JetBrains Mono', size: 9 };
    const tooltipLabelBar = (ctx: { parsed: { y?: number; x?: number } | number }) => {
      const v = typeof ctx.parsed === 'number' ? ctx.parsed : (ctx.parsed.y ?? ctx.parsed.x ?? 0);
      return fmtM(v);
    };

    // Chart 1: Profit vs Saldo (Line)
    destroyChart('pvsaldo');
    if (chartPvSaldoRef.current && sortedFlt.length > 0) {
      const dayPLMap: Record<string, number> = {};
      sortedFlt.forEach(t => { dayPLMap[t.tanggal] = (dayPLMap[t.tanggal] || 0) + (t._pl || 0); });
      const pvsDays = Object.keys(dayPLMap).sort();
      let pvsCum = 0;
      const pvsCumData = pvsDays.map(d => { pvsCum += dayPLMap[d]; return pvsCum; });
      const daySaldoMap: Record<string, number> = {};
      [...computedTrades].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1)
        .forEach(t => { if (t._saldo != null) daySaldoMap[t.tanggal] = t._saldo; });
      const pvsSaldoData = pvsDays.map(d => {
        const days = Object.keys(daySaldoMap).filter(k => k <= d).sort();
        return days.length ? daySaldoMap[days[days.length - 1]] : null;
      });
      chartInstances.current['pvsaldo'] = new Chart(chartPvSaldoRef.current, {
        type: 'line',
        data: { labels: pvsDays.map(fmtDate), datasets: [
          { label: 'Total Profit', data: pvsCumData,    borderColor: C.green, backgroundColor: C.greenBg, borderWidth: 2, pointRadius: pvsDays.length <= 14 ? 3 : 2, fill: true,  tension: 0.3 },
          { label: 'Total Saldo',  data: pvsSaldoData,  borderColor: C.gold,  backgroundColor: 'transparent',              borderWidth: 2, pointRadius: pvsDays.length <= 14 ? 3 : 2, fill: false, tension: 0.3 },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: { legend: { labels: { color: C.text, font: fontOpts, boxWidth: 10 } }, tooltip: { callbacks: { label: tooltipLabelBar } } },
          scales: {
            x: { ticks: { color: C.text, font: { size: 8 }, maxTicksLimit: 12, maxRotation: 0 }, grid: { color: C.grid } },
            y: { ticks: { color: C.text, font: { size: 8 }, callback: (v: string | number) => fmtM(Number(v)) }, grid: { color: C.grid } },
          },
        },
      });
    }

    // Chart 2: Session donut — FIX: pakai C.gold, C.green, C.blue (bukan variabel bebas)
    destroyChart('session');
    if (chartSessionRef.current) {
      const sessColors = [C.gold, C.green, C.blue];
      const sessTotals = sesiData.map(s => s.total);
      const totalSess  = sessTotals.reduce((a, v) => a + v, 0);
      if (totalSess > 0) {
        chartInstances.current['session'] = new Chart(chartSessionRef.current, {
          type: 'doughnut',
          data: {
            labels: sesiData.map(s => s.session),
            datasets: [{ data: sessTotals, backgroundColor: sessColors, borderColor: C.bgColor, borderWidth: 3, hoverOffset: 6 }],
          },
          options: {
            responsive: false, animation: { duration: 500 }, cutout: '60%',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${ctx.parsed} trade (${Math.round(ctx.parsed / totalSess * 100)}%)` } },
            },
          },
        });
      }
    }

    // Chart 3: Daily profit bar
    destroyChart('daily');
    if (chartDailyRef.current && sortedFlt.length > 0) {
      const dailyMap: Record<string, number> = {};
      sortedFlt.forEach(t => { dailyMap[t.tanggal] = (dailyMap[t.tanggal] || 0) + (t._pl || 0); });
      const days = Object.keys(dailyMap).sort();
      chartInstances.current['daily'] = new Chart(chartDailyRef.current, {
        type: 'bar',
        data: { labels: days.map(fmtDate), datasets: [{ label: 'P/L Harian', data: days.map(d => dailyMap[d]),
          backgroundColor: days.map(d => dailyMap[d] >= 0 ? C.greenBg : C.redBg),
          borderColor:     days.map(d => dailyMap[d] >= 0 ? C.green   : C.red),
          borderWidth: 1.5, borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipLabelBar } } },
          scales: {
            x: { ticks: { color: C.text, font: { size: 8 }, maxRotation: 45 }, grid: { color: C.grid } },
            y: { ticks: { color: C.text, font: { size: 8 }, callback: (v: string | number) => fmtM(Number(v)) }, grid: { color: C.grid } },
          },
        },
      });
    }

    // Chart 4: Performa per Pair — horizontal bar
    destroyChart('pair');
    const activePairs = pairData.filter(p => p.total > 0);
    if (chartPairRef.current && activePairs.length > 0) {
      chartInstances.current['pair'] = new Chart(chartPairRef.current, {
        type: 'bar',
        data: {
          labels: activePairs.map(p => p.pair),
          datasets: [
            { label: 'Profit', data: activePairs.map(p => p.profit), backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 1.5, borderRadius: 3 },
            { label: 'Lose',   data: activePairs.map(p => p.lose),   backgroundColor: C.redBg,   borderColor: C.red,   borderWidth: 1.5, borderRadius: 3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
          plugins: { legend: { labels: { color: C.text, font: fontOpts, boxWidth: 10 } }, tooltip: { callbacks: { label: tooltipLabelBar } } },
          scales: {
            x: { ticks: { color: C.text, font: { size: 8 }, callback: (v: string | number) => fmtM(Number(v)) }, grid: { color: C.grid }, stacked: false },
            y: { ticks: { color: C.text, font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: C.grid } },
          },
        },
      });
    }

    return () => { ['pvsaldo', 'session', 'daily', 'pair'].forEach(destroyChart); };
  }, [mounted, active, sortedFlt, sesiData, pairData, currency]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleStrategi = (v: string) => {
    if (v === '') { setFStrategi([]); return; }
    setFStrategi(prev => prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v]);
  };

  const resetFlt = () => { setFPair(''); setFSesi(''); setFResult(''); setFStrategi([]); };

  const fmt  = (v: number) => fmtDispCur(v, currency);
  const fmtM = (v: number) => fmtMoney(v, currency);

  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-filter" />;

  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') !== 'light'
    : true;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`page${active ? ' active' : ''}`} id="page-filter">

      {/* PAGE HEADER */}
      <div className="ph">
        <div>
          <div className="ph-label">🔍 Modul 04 — Analisa Performa</div>
          <h1 className="ph-title">Filter <em>Trading</em></h1>
          <p className="ph-sub">Analisis performa berdasarkan pair, sesi, result, dan strategi.</p>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700, color: 'var(--gold2)', padding: '4px 12px', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)', borderRadius: '6px' }}>
          {currency}
        </span>
      </div>

      {/* FILTER BAR */}
      <div className="flt-bar">
        <div className="flt-dd-row">
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
            <label className="flabel">🌏 Sesi Market</label>
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
                <option value="">Semua Result</option>
                <option value="Profit">Profit</option>
                <option value="Lose">Lose</option>
              </select>
            </div>
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button className="btn btn-ghost btn-sm" onClick={resetFlt} style={{ alignSelf: 'flex-end' }}>↺ Reset</button>
          </div>
        </div>

        {/* Strategi chips */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '11px', marginTop: '8px' }}>
          <label className="flabel" style={{ display: 'block', marginBottom: '7px' }}>
            🎯 Strategi — pilih lebih dari 1
            {fStrategi.length > 0 && <span style={{ color: 'var(--gold2)', marginLeft: '4px' }}>{fStrategi.length} dipilih</span>}
          </label>
          <div className="flt-strat-wrap">
            {STRATEGI_CHIPS.map(c => (
              <div
                key={c.v || 'semua'}
                className={`flt-strat-chip${c.v === '' ? ' semua' : ''}${(c.v === '' && fStrategi.length === 0) || (c.v !== '' && fStrategi.includes(c.v)) ? ' active' : ''}`}
                onClick={() => toggleStrategi(c.v)}
              >
                {c.l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP STATS 8 CARDS */}
      <div className="flt-stats-row">
        <div className="flt-scard green"><div className="flt-scard-lbl">Total Profit</div><div className="flt-scard-val green">{stats.total ? fmtM(stats.totalProfit) : '—'}</div></div>
        <div className="flt-scard red">  <div className="flt-scard-lbl">Total Lose</div>  <div className="flt-scard-val red">{stats.total ? fmtM(stats.totalLose) : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total P - L</div> <div className={`flt-scard-val ${stats.totalPL > 0 ? 'green' : stats.totalPL < 0 ? 'red' : ''}`}>{stats.total ? fmtM(stats.totalPL) : '—'}</div></div>
        <div className="flt-scard gold"> <div className="flt-scard-lbl">Total Saldo</div> <div className="flt-scard-val gold">{fmtM(stats.totalSaldo)}</div></div>
        <div className="flt-scard blue"> <div className="flt-scard-lbl">Total D - W</div> <div className="flt-scard-val blue">{fmtM(stats.dwTotal)}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Total Trade</div> <div className="flt-scard-val">{stats.total}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Win Rate</div>    <div className={`flt-scard-val ${stats.wr >= 50 ? 'green' : 'red'}`}>{stats.total ? stats.wr.toFixed(1) + '%' : '—'}</div></div>
        <div className="flt-scard">      <div className="flt-scard-lbl">Avg P/L</div>     <div className="flt-scard-val">{stats.total ? fmtM(stats.avgPL) : '—'}</div></div>
      </div>

      {/* ROW 1: Line + Donut */}
      <div className="g2" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">📈 Total Profit vs Total Saldo</div></div>
          <div className="box-body" style={{ padding: '14px 16px', position: 'relative', minHeight: '180px' }}>
            <canvas ref={chartPvSaldoRef} />
            {sortedFlt.length === 0 && (
              <div className="ph-empty" style={{ position: 'absolute', inset: 0, background: 'transparent' }}>
                <div className="ph-icon">📊</div>Tambahkan data trading dulu
              </div>
            )}
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">🌏 Market Session</div></div>
          <div className="box-body" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
            <div style={{ width: '150px', height: '150px', flexShrink: 0 }}>
              <canvas ref={chartSessionRef} width={150} height={150} style={{ display: 'block', width: '150px', height: '150px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
              {(() => {
                const totalTrades = sesiData.reduce((s, d) => s + d.total, 0);
                const sessColors2 = [isDark ? '#E8C567' : '#B8882A', '#22C55E', isDark ? '#60A5FA' : '#2563EB'];
                if (!totalTrades) return <div style={{ color: 'var(--text3)', fontSize: '11px' }}>Belum ada data</div>;
                return sesiData.map((s, i) => {
                  const pct = totalTrades ? Math.round(s.total / totalTrades * 100) : 0;
                  const pl  = s.profit + s.lose;
                  const plColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
                  const plSign  = pl >= 0 ? '+' : '';
                  return (
                    <div key={s.session} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: sessColors2[i], flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', color: 'var(--text2)' }}>
                        {s.session} — {s.total} trade{' '}
                        <span style={{ color: plColor, fontWeight: 700 }}>
                          {plSign}{pct}%
                        </span>
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Daily + Pair Charts */}
      <div className="g2" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">📅 Total Profit per Tanggal</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '160px' }}>
            <canvas ref={chartDailyRef} />
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">💱 Performa per Pair</div></div>
          <div className="box-body" style={{ padding: '14px 16px', minHeight: '160px' }}>
            <canvas ref={chartPairRef} />
          </div>
        </div>
      </div>

      {/* ROW 3: Session + Pair Tables */}
      <div className="g2" style={{ marginBottom: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">🌏 Market Session</div></div>
          <div className="box-body-0">
            <table className="rtable">
              <thead>
                <tr>
                  <td className="lbl" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>Keterangan</td>
                  <td className="val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>#</td>
                  <td className="val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>Total</td>
                </tr>
              </thead>
              <tbody>
                {sesiData.filter(s => s.total > 0).length === 0 ? (
                  <tr><td colSpan={3}><div className="ph-empty" style={{ padding: '12px' }}><div className="ph-icon">📭</div>Belum ada data</div></td></tr>
                ) : sesiData.filter(s => s.total > 0).map(s => {
                  const icons: Record<string, string> = { Asia: '🌏', London: '🇬🇧', US: '🗽' };
                  const pl = s.profit + s.lose;
                  return (
                    <tr key={s.session}>
                      <td className="lbl">{icons[s.session] || ''} {s.session}</td>
                      <td className="val">{s.total}</td>
                      <td className={`val ${pl >= 0 ? 'green' : 'red'}`}>{fmtM(pl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <div className="box-head"><div className="box-title">💱 Pair Data</div></div>
          <div className="box-body-0">
            <table className="rtable">
              <thead>
                <tr>
                  <td className="lbl" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>Keterangan</td>
                  <td className="val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>#</td>
                  <td className="val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', padding: '8px 15px' }}>Total</td>
                </tr>
              </thead>
              <tbody>
                {pairData.length === 0 ? (
                  <tr><td colSpan={3}><div className="ph-empty" style={{ padding: '12px' }}><div className="ph-icon">📭</div>Belum ada data</div></td></tr>
                ) : pairData.map(p => (
                  <tr key={p.pair}>
                    <td className="lbl">💱 {p.pair}</td>
                    <td className="val">{p.total}</td>
                    <td className={`val ${(p.profit + p.lose) >= 0 && p.total > 0 ? 'green' : 'red'}`}>
                      {p.total ? fmtM(p.profit + p.lose) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* KESIMPULAN */}
      {filtered.length > 0 && (() => {
        const wins        = filtered.filter(t => t.result === 'Profit').length;
        const losses      = filtered.filter(t => t.result === 'Lose').length;
        const totalPLK    = filtered.reduce((s, t) => s + (t._pl || 0), 0);
        const totalProfitK = filtered.filter(t => t.result === 'Profit').reduce((s, t) => s + (t._pl || 0), 0);
        const totalLoseK  = filtered.filter(t => t.result === 'Lose').reduce((s, t) => s + (t._pl || 0), 0);
        const wr = filtered.length ? Math.round((wins / filtered.length) * 100) : 0;
        const pf = totalLoseK !== 0 ? (Math.abs(totalProfitK / totalLoseK)).toFixed(2) : '∞';
        const pairMap: Record<string, number> = {};
        filtered.forEach(t => { if (!pairMap[t.pair]) pairMap[t.pair] = 0; pairMap[t.pair] += (t._pl || 0); });
        const bestPair = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0];
        const sesiMap: Record<string, number> = {};
        filtered.forEach(t => { if (!sesiMap[t.sesi]) sesiMap[t.sesi] = 0; sesiMap[t.sesi] += (t._pl || 0); });
        const bestSesi = Object.entries(sesiMap).sort((a, b) => b[1] - a[1])[0];
        const plColor = totalPLK >= 0 ? 'var(--green)' : 'var(--red)';
        const wrColor = wr >= 50 ? 'var(--green)' : 'var(--red)';
        return (
          <div className="box" style={{ marginBottom: '14px' }}>
            <div className="box-head"><div className="box-title">💡 Kesimpulan Analisa</div></div>
            <div className="box-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Total P/L</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: plColor }}>{fmtM(totalPLK)}</div>
                </div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Win Rate</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: wrColor }}>
                    {wr}% <span style={{ fontSize: '10px', color: 'var(--text3)' }}>({wins}W/{losses}L)</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '4px' }}>Profit Factor</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: 'var(--gold2)' }}>{pf}</div>
                </div>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.8 }}>
                Dari <strong style={{ color: 'var(--text)' }}>{filtered.length} trade</strong> yang difilter,{' '}
                total P/L adalah <strong style={{ color: plColor }}>{fmtM(totalPLK)}</strong>{' '}
                dengan win rate <strong style={{ color: wrColor }}>{wr}%</strong>.{' '}
                {bestPair && <>Pair terbaik: <strong style={{ color: 'var(--gold2)' }}>{bestPair[0]}</strong> ({fmtM(bestPair[1])}).{' '}</>}
                {bestSesi && <>Sesi paling profitable: <strong style={{ color: 'var(--gold2)' }}>{bestSesi[0]}</strong>.{' '}</>}
                {wr >= 60 ? '🔥 ' : wr >= 50 ? '✅ ' : '⚠️ '}
                <strong>{wr >= 60 ? 'Performa sangat baik! Pertahankan konsistensi kamu.' : wr >= 50 ? 'Win rate di atas 50%, terus tingkatkan.' : 'Win rate perlu diperbaiki.'}</strong>
                {wr < 50 && ' Evaluasi setup dan entry kamu.'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* DATA TABLE */}
      <div className="box">
        <div className="box-head">
          <div className="box-title">📋 Data Trading (Terfilter)</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: 'var(--text3)' }}>
            {filtered.length} trade
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>No</th><th>Tanggal</th><th>Bulan</th><th>Sesi</th><th>Pair</th><th>Posisi</th>
                <th>Lot</th><th>Entry</th><th>SL</th><th>TP</th><th>Close</th><th>Result</th>
                <th>Pips</th><th>P/L</th><th>Total Profit</th><th>Total Saldo</th><th>Strategi</th><th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {sortedFlt.length === 0 ? (
                <tr><td colSpan={18}><div className="ph-empty"><div className="ph-icon">🔍</div>Pilih filter untuk melihat data.</div></td></tr>
              ) : sortedFlt.map((t, i) => {
                const bulan = t.tanggal ? new Date(t.tanggal + 'T00:00:00').toLocaleString('id-ID', { month: 'long' }) : '—';
                const runProfit = sortedFlt.slice(0, i + 1).reduce((s, x) => s + (x._pl || 0), 0);
                const metodeArr = (t.metode || t.strategi || '').split(',').map(s => s.trim()).filter(Boolean);
                return (
                  <tr key={t.id} style={{ fontSize: '9.5px' }}>
                    <td className="no">{i + 1}</td>
                    <td className="str" style={{ fontSize: '10px' }}>{(() => { try { return new Date(t.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return t.tanggal; } })()}</td>
                    <td style={{ fontSize: '9px', color: 'var(--text3)' }}>{bulan}</td>
                    <td><span className="chip chip-blue">{t.sesi || '—'}</span></td>
                    <td className="str">{t.pair || '—'}</td>
                    <td><span className={`chip ${t.result === 'Profit' ? 'chip-buy' : 'chip-sell'}`}>{t.posisi || '—'}</span></td>
                    <td>{t.lot}</td>
                    <td>{t.entry}</td>
                    <td style={{ color: 'var(--red)' }}>{t.sl || '—'}</td>
                    <td style={{ color: 'var(--green)' }}>{t.tp || '—'}</td>
                    <td>{t.close}</td>
                    <td><span className={`chip ${t.result === 'Profit' ? 'chip-profit' : 'chip-lose'}`}>{t.result}</span></td>
                    <td>{t.pips != null ? Math.abs(t.pips).toFixed(2) : '—'}</td>
                    <td className={(t._pl || 0) >= 0 ? 'pos-val' : 'neg-val'}>{t._pl != null ? fmt(t._pl) : '—'}</td>
                    <td className={runProfit >= 0 ? 'pos-val' : 'neg-val'} style={{ fontSize: '9.5px' }}>{fmt(runProfit)}</td>
                    <td className="saldo-val">{fmt(t._saldo ?? 0)}</td>
                    <td style={{ fontSize: '9px' }}>
                      {metodeArr.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                          <span className="chip chip-gold" style={{ fontSize: '7.5px', padding: '1px 5px', whiteSpace: 'nowrap' }}>{metodeArr.join(', ')}</span>
                          {t.riskLevel && <span className="chip" style={{ fontSize: '7px', padding: '1px 4px', whiteSpace: 'nowrap', background: t.riskLevel === 'HIGH RISK' ? 'rgba(232,64,64,0.12)' : t.riskLevel === 'LOW RISK' ? 'var(--green-bg)' : 'rgba(201,168,76,0.12)', color: t.riskLevel === 'HIGH RISK' ? 'var(--red)' : t.riskLevel === 'LOW RISK' ? 'var(--green)' : 'var(--gold)' }}>{t.riskLevel}</span>}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '9px', color: 'var(--text3)' }} title={t.catatan || ''}>
                      {t.catatan || '—'}
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