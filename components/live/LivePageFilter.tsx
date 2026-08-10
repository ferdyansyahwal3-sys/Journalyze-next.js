'use client';
/**
 * components/live/LivePageFilter.tsx
 * Phase 10
 * Field: _pl, result, posisi, tanggal, pair, sesi, metode/strategi
 */

import type { Trade } from '../../lib/types';
import { LivePageData } from './LivePageData';

interface Props {
  trades: Trade[];
  filteredTrades: Trade[];
  uniquePairs: string[];
  filterPair: string;
  filterDir: string;
  filterResult: string;
  filterDateFrom: string;
  filterDateTo: string;
  setFilterPair: (v: string) => void;
  setFilterDir: (v: string) => void;
  setFilterResult: (v: string) => void;
  setFilterDateFrom: (v: string) => void;
  setFilterDateTo: (v: string) => void;
  onReset: () => void;
}

function fmtNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPl(n: number) { return (n >= 0 ? '+' : '') + fmtNum(n); }

export function LivePageFilter({
  trades, filteredTrades, uniquePairs,
  filterPair, filterDir, filterResult, filterDateFrom, filterDateTo,
  setFilterPair, setFilterDir, setFilterResult, setFilterDateFrom, setFilterDateTo,
  onReset,
}: Props) {
  const total    = filteredTrades.length;
  const wins     = filteredTrades.filter(t => t.result === 'Profit').length;
  const losses   = filteredTrades.filter(t => t.result === 'Lose').length;
  const be       = total - wins - losses;
  const totalPl  = filteredTrades.reduce((s, t) => s + (t._pl ?? 0), 0);
  const winRate  = total > 0 ? (wins / total) * 100 : 0;
  const avgPl    = total > 0 ? totalPl / total : 0;
  const winPl    = filteredTrades.filter(t => t.result === 'Profit').reduce((s, t) => s + (t._pl ?? 0), 0);
  const lossPl   = filteredTrades.filter(t => t.result === 'Lose').reduce((s, t) => s + (t._pl ?? 0), 0);
  const pf       = lossPl !== 0 ? Math.abs(winPl / lossPl) : 0;

  return (
    <section id="page-filter" className="page active">
      <div className="ph">
        <div>
          <div className="ph-label">Filter</div>
          <h2 className="ph-title">Filter <em>Trade</em></h2>
          <p className="ph-sub">{filteredTrades.length} dari {trades.length} trade</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flt-bar">
        <div className="flt-dd-row">
          <div className="fg">
            <label className="flabel">💱 Pair</label>
            <div className="selwrap">
              <select className="fselect" value={filterPair} onChange={e => setFilterPair(e.target.value)}>
                <option value="">Semua Pair</option>
                {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">📊 Posisi</label>
            <div className="selwrap">
              <select className="fselect" value={filterDir} onChange={e => setFilterDir(e.target.value)}>
                <option value="">Semua</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">📊 Result</label>
            <div className="selwrap">
              <select className="fselect" value={filterResult} onChange={e => setFilterResult(e.target.value)}>
                <option value="">Semua</option>
                <option value="Profit">Profit</option>
                <option value="Lose">Lose</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">📅 Dari</label>
            <input type="date" className="finput" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="fg">
            <label className="flabel">📅 Sampai</label>
            <input type="date" className="finput" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onReset} style={{ alignSelf: 'flex-end' }}>↺ Reset</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flt-stats-row">
        <div className="flt-scard gold"><div className="flt-scard-lbl">Total</div><div className="flt-scard-val gold">{total}</div></div>
        <div className="flt-scard green"><div className="flt-scard-lbl">Win</div><div className="flt-scard-val green">{wins}</div></div>
        <div className="flt-scard red"><div className="flt-scard-lbl">Loss</div><div className="flt-scard-val red">{losses}</div></div>
        <div className="flt-scard"><div className="flt-scard-lbl">BE</div><div className="flt-scard-val">{be}</div></div>
        <div className={`flt-scard ${winRate >= 50 ? 'green' : 'red'}`}>
          <div className="flt-scard-lbl">Win Rate</div>
          <div className={`flt-scard-val ${winRate >= 50 ? 'green' : 'red'}`}>{winRate.toFixed(1)}%</div>
        </div>
        <div className={`flt-scard ${totalPl >= 0 ? 'green' : 'red'}`}>
          <div className="flt-scard-lbl">Total P/L</div>
          <div className={`flt-scard-val ${totalPl >= 0 ? 'green' : 'red'}`}>{fmtPl(totalPl)}</div>
        </div>
        <div className={`flt-scard ${avgPl >= 0 ? 'green' : 'red'}`}>
          <div className="flt-scard-lbl">Avg P/L</div>
          <div className={`flt-scard-val ${avgPl >= 0 ? 'green' : 'red'}`}>{fmtPl(avgPl)}</div>
        </div>
        <div className="flt-scard blue">
          <div className="flt-scard-lbl">Profit Factor</div>
          <div className="flt-scard-val blue">{pf > 0 ? pf.toFixed(2) : '-'}</div>
        </div>
      </div>

      {/* Tabel hasil filter */}
      <LivePageData trades={filteredTrades} />
    </section>
  );
}