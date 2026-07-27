'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTradeStore, recalcAll } from '@/store/useTradeStore';
import { fmtMoney, fmtDispCur } from '@/lib/riskCalc';
import type { Trade } from '@/lib/types';
import type { Currency } from '@/lib/riskCalc';

// ─── helpers ────────────────────────────────────────────────────────────────

function getRiskState() {
  try {
    const s = JSON.parse(localStorage.getItem('jz_state') || 'null');
    return s || { balance: 0, target: 0, pair: 'XAUUSD', currency: 'IDR', risk: 1, months: 1, leverage: 500 };
  } catch {
    return { balance: 0, target: 0, pair: 'XAUUSD', currency: 'IDR', risk: 1, months: 1, leverage: 500 };
  }
}

function getKurs(): number {
  try {
    const s = JSON.parse(localStorage.getItem('jz_rates') || 'null');
    return s?.USD_IDR ?? 16000;
  } catch {
    return 16000;
  }
}

function winStreakCalc(trades: Trade[]): number {
  let max = 0, cur = 0;
  for (const t of trades) {
    if (t.result === 'Profit') { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function lossStreakCalc(trades: Trade[]): number {
  let max = 0, cur = 0;
  for (const t of trades) {
    if (t.result === 'Lose') { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function uniqueDays(trades: Trade[]): number {
  return new Set(trades.map(t => t.tanggal?.slice(0, 10))).size;
}

// ─── types ──────────────────────────────────────────────────────────────────

interface FilterState {
  pair: string;
  sesi: string;
  strategi: string;
  metode: string;
  result: string;
  bulan: string;
  riskLevel: string;
  emosiKontrol: string;
}

const INITIAL_FILTER: FilterState = {
  pair: '', sesi: '', strategi: '', metode: '',
  result: '', bulan: '', riskLevel: '', emosiKontrol: '',
};

// ─── component ──────────────────────────────────────────────────────────────

export default function PageFilter({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [rs, setRs] = useState({ balance: 0, target: 0, pair: 'XAUUSD', currency: 'IDR', risk: 1, months: 1, leverage: 500 });
  const [kurs, setKurs] = useState(16000);
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [sortCol, setSortCol] = useState<string>('tanggal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { trades, dwList } = useTradeStore();

  useEffect(() => {
    setMounted(true);
    setRs(getRiskState());
    setKurs(getKurs());
  }, []);

  const currency: Currency = (rs.currency ?? 'IDR') as Currency;
  const balanceIDR: number = rs.balance ?? 0;

  // ── semua useMemo di atas early return ──────────────────────────────────

  const computedTrades = useMemo(() => {
    if (!mounted) return [];
    return recalcAll(trades, dwList, currency, balanceIDR, kurs);
  }, [mounted, trades, dwList, currency, balanceIDR, kurs]);

  const opts = useMemo(() => {
    const uniq = (key: keyof Trade) =>
      [...new Set(computedTrades.map(t => String(t[key] ?? '')).filter(Boolean))].sort();
    return {
      pair: uniq('pair'),
      sesi: uniq('sesi'),
      strategi: uniq('strategi'),
      metode: uniq('metode'),
      riskLevel: uniq('riskLevel'),
      emosiKontrol: uniq('emosiKontrol'),
      bulan: [...new Set(computedTrades.map(t => t.tanggal?.slice(0, 7)).filter(Boolean))].sort().reverse(),
    };
  }, [computedTrades]);

  const filtered = useMemo(() => {
    return computedTrades.filter(t => {
      if (filter.pair && t.pair !== filter.pair) return false;
      if (filter.sesi && t.sesi !== filter.sesi) return false;
      if (filter.strategi && t.strategi !== filter.strategi) return false;
      if (filter.metode && t.metode !== filter.metode) return false;
      if (filter.result && t.result !== filter.result) return false;
      if (filter.bulan && !t.tanggal?.startsWith(filter.bulan)) return false;
      if (filter.riskLevel && t.riskLevel !== filter.riskLevel) return false;
      if (filter.emosiKontrol && t.emosiKontrol !== filter.emosiKontrol) return false;
      return true;
    });
  }, [computedTrades, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortCol as keyof Trade] ?? '';
      const vb = b[sortCol as keyof Trade] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const stats = useMemo(() => {
    const wins = filtered.filter(t => t.result === 'Profit');
    const losses = filtered.filter(t => t.result === 'Lose');
    const totalPL = filtered.reduce((s, t) => s + (t._pl ?? 0), 0);
    const totalW = wins.reduce((s, t) => s + (t._pl ?? 0), 0);
    const totalL = losses.reduce((s, t) => s + Math.abs(t._pl ?? 0), 0);
    const pf = totalL > 0 ? totalW / totalL : totalW > 0 ? Infinity : 0;
    const avgRR = filtered.length
      ? filtered.reduce((s, t) => s + (t.rr ?? 0), 0) / filtered.length
      : 0;
    return {
      total: filtered.length,
      wins: wins.length,
      losses: losses.length,
      winRate: filtered.length ? (wins.length / filtered.length) * 100 : 0,
      totalPL,
      avgProfit: wins.length ? totalW / wins.length : 0,
      avgLoss: losses.length ? totalL / losses.length : 0,
      profitFactor: pf,
      winStreak: winStreakCalc(filtered),
      lossStreak: lossStreakCalc(filtered),
      avgRR,
      hariTrading: uniqueDays(filtered),
    };
  }, [filtered]);

  const byPair = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pl: number }> = {};
    for (const t of filtered) {
      if (!map[t.pair]) map[t.pair] = { wins: 0, total: 0, pl: 0 };
      map[t.pair].total++;
      if (t.result === 'Profit') map[t.pair].wins++;
      map[t.pair].pl += t._pl ?? 0;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  const bySesi = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pl: number }> = {};
    for (const t of filtered) {
      const s = t.sesi || 'N/A';
      if (!map[s]) map[s] = { wins: 0, total: 0, pl: 0 };
      map[s].total++;
      if (t.result === 'Profit') map[s].wins++;
      map[s].pl += t._pl ?? 0;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  // ── early return setelah semua hooks ────────────────────────────────────
  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-filter" />;

  // ── event handlers ───────────────────────────────────────────────────────
  const setF = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilter(prev => ({ ...prev, [key]: e.target.value }));

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortIcon = (col: string) =>
    sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const resetFilter = () => setFilter(INITIAL_FILTER);
  const plClass = (v: number) => (v > 0 ? 'profit' : v < 0 ? 'lose' : '');

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className={`page${active ? ' active' : ''}`} id="page-filter">
      <div className="page-header">
        <h2 className="page-title">
          <span className="page-title-icon">🔍</span> Filter &amp; Analisis
        </h2>
      </div>

      {/* ── filter bar ── */}
      <div className="filter-bar card">
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label">Pair</label>
            <select className="filter-select" value={filter.pair} onChange={setF('pair')}>
              <option value="">Semua</option>
              {opts.pair.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Sesi</label>
            <select className="filter-select" value={filter.sesi} onChange={setF('sesi')}>
              <option value="">Semua</option>
              {opts.sesi.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Strategi</label>
            <select className="filter-select" value={filter.strategi} onChange={setF('strategi')}>
              <option value="">Semua</option>
              {opts.strategi.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Metode</label>
            <select className="filter-select" value={filter.metode} onChange={setF('metode')}>
              <option value="">Semua</option>
              {opts.metode.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Result</label>
            <select className="filter-select" value={filter.result} onChange={setF('result')}>
              <option value="">Semua</option>
              <option value="Profit">Profit</option>
              <option value="Lose">Lose</option>
              <option value="BE">BE</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Bulan</label>
            <select className="filter-select" value={filter.bulan} onChange={setF('bulan')}>
              <option value="">Semua</option>
              {opts.bulan.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Risk Level</label>
            <select className="filter-select" value={filter.riskLevel} onChange={setF('riskLevel')}>
              <option value="">Semua</option>
              {opts.riskLevel.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Emosi</label>
            <select className="filter-select" value={filter.emosiKontrol} onChange={setF('emosiKontrol')}>
              <option value="">Semua</option>
              {opts.emosiKontrol.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn btn-secondary btn-sm" onClick={resetFilter}>Reset Filter</button>
          <span className="filter-count">{filtered.length} trade ditemukan</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📊</div>
          <div className="empty-text">Tidak ada data trade yang cocok dengan filter ini.</div>
        </div>
      ) : (
        <>
          {/* ── rekap statistik ── */}
          <div className="filter-stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Trade</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win Rate</div>
              <div className={`stat-value ${stats.winRate >= 50 ? 'profit' : 'lose'}`}>
                {stats.winRate.toFixed(1)}%
              </div>
              <div className="stat-sub">{stats.wins}W / {stats.losses}L</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total P/L</div>
              <div className={`stat-value ${plClass(stats.totalPL)}`}>
                {fmtDispCur(stats.totalPL, currency)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Profit</div>
              <div className="stat-value profit">
                {stats.wins > 0 ? fmtDispCur(stats.avgProfit, currency) : '-'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Loss</div>
              <div className="stat-value lose">
                {stats.losses > 0 ? fmtDispCur(-stats.avgLoss, currency) : '-'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profit Factor</div>
              <div className={`stat-value ${stats.profitFactor >= 1 ? 'profit' : 'lose'}`}>
                {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win Streak</div>
              <div className="stat-value profit">{stats.winStreak}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Loss Streak</div>
              <div className="stat-value lose">{stats.lossStreak}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg RR</div>
              <div className="stat-value">{stats.avgRR.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Hari Trading</div>
              <div className="stat-value">{stats.hariTrading}</div>
            </div>
          </div>

          {/* ── breakdown per pair & sesi ── */}
          <div className="filter-breakdown-row">
            <div className="card filter-breakdown-card">
              <div className="card-title">Breakdown per Pair</div>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Pair</th><th>Trade</th><th>WR%</th><th>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {byPair.map(([pair, v]) => (
                    <tr key={pair}>
                      <td>{pair}</td>
                      <td>{v.total}</td>
                      <td>{v.total ? ((v.wins / v.total) * 100).toFixed(0) : 0}%</td>
                      <td className={plClass(v.pl)}>{fmtDispCur(v.pl, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card filter-breakdown-card">
              <div className="card-title">Breakdown per Sesi</div>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Sesi</th><th>Trade</th><th>WR%</th><th>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {bySesi.map(([sesi, v]) => (
                    <tr key={sesi}>
                      <td>{sesi}</td>
                      <td>{v.total}</td>
                      <td>{v.total ? ((v.wins / v.total) * 100).toFixed(0) : 0}%</td>
                      <td className={plClass(v.pl)}>{fmtDispCur(v.pl, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── tabel trade hasil filter ── */}
          <div className="card">
            <div className="card-title">Daftar Trade ({filtered.length})</div>
            <div className="table-wrapper">
              <table className="data-table filter-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('seq')} className="sortable">#{sortIcon('seq')}</th>
                    <th onClick={() => toggleSort('tanggal')} className="sortable">Tanggal{sortIcon('tanggal')}</th>
                    <th onClick={() => toggleSort('pair')} className="sortable">Pair{sortIcon('pair')}</th>
                    <th onClick={() => toggleSort('sesi')} className="sortable">Sesi{sortIcon('sesi')}</th>
                    <th onClick={() => toggleSort('posisi')} className="sortable">Posisi{sortIcon('posisi')}</th>
                    <th onClick={() => toggleSort('lot')} className="sortable">Lot{sortIcon('lot')}</th>
                    <th onClick={() => toggleSort('pips')} className="sortable">Pips{sortIcon('pips')}</th>
                    <th onClick={() => toggleSort('rr')} className="sortable">RR{sortIcon('rr')}</th>
                    <th onClick={() => toggleSort('result')} className="sortable">Result{sortIcon('result')}</th>
                    <th onClick={() => toggleSort('_pl')} className="sortable">P/L{sortIcon('_pl')}</th>
                    <th onClick={() => toggleSort('_saldo')} className="sortable">Saldo{sortIcon('_saldo')}</th>
                    <th onClick={() => toggleSort('strategi')} className="sortable">Strategi{sortIcon('strategi')}</th>
                    <th onClick={() => toggleSort('emosiKontrol')} className="sortable">Emosi{sortIcon('emosiKontrol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t, i) => (
                    <tr key={t.id} className={`result-${t.result?.toLowerCase()}`}>
                      <td>{t.seq ?? i + 1}</td>
                      <td>{t.tanggal}</td>
                      <td>{t.pair}</td>
                      <td>{t.sesi}</td>
                      <td className={t.posisi === 'BUY' ? 'buy' : 'sell'}>{t.posisi}</td>
                      <td>{t.lot ?? '-'}</td>
                      <td>{t.pips != null ? t.pips.toFixed(1) : '-'}</td>
                      <td>{t.rr != null ? t.rr.toFixed(2) : '-'}</td>
                      <td className={t.result === 'Profit' ? 'profit' : t.result === 'Lose' ? 'lose' : ''}>
                        {t.result}
                      </td>
                      <td className={plClass(t._pl ?? 0)}>
                        {t._pl != null ? fmtDispCur(t._pl, currency) : '-'}
                      </td>
                      <td>{t._saldo != null ? fmtMoney(t._saldo, currency) : '-'}</td>
                      <td>{t.strategi || '-'}</td>
                      <td>{t.emosiKontrol || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}