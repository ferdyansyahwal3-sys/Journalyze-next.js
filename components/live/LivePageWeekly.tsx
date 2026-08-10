'use client';
/**
 * components/live/LivePageWeekly.tsx
 * Phase 10 — field Trade: tanggal, _pl, result
 */

import { useState, useMemo } from 'react';
import type { Trade, WeeklyReview } from '../../lib/types';

interface Props {
  trades: Trade[];
  weeklyReviews: WeeklyReview[];
}

function fmtDate(s?: string | null): string {
  if (!s) return '-';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function fmtPl(n: number): string {
  return (n >= 0 ? '+' : '') + n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export function LivePageWeekly({ trades, weeklyReviews }: Props) {
  const [filterYear,  setFilterYear]  = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Unique years dari week_start review
  const years = useMemo(() => {
    const ys = weeklyReviews
      .map(w => w.week_start?.slice(0, 4))
      .filter(Boolean) as string[];
    return Array.from(new Set(ys)).sort().reverse();
  }, [weeklyReviews]);

  // Filtered reviews
  const filtered = useMemo(() => {
    return weeklyReviews.filter(w => {
      if (filterYear  && w.week_start?.slice(0, 4) !== filterYear)  return false;
      if (filterMonth && w.week_start?.slice(5, 7) !== filterMonth) return false;
      return true;
    });
  }, [weeklyReviews, filterYear, filterMonth]);

  // Stats
  const totalTrades = filtered.reduce((s, w) => s + (w.total_trades ?? 0), 0);
  const totalWins   = filtered.reduce((s, w) => s + (w.wins ?? 0), 0);
  const totalPl     = filtered.reduce((s, w) => s + (w.total_pnl ?? 0), 0);
  const avgWR       = filtered.length > 0
    ? filtered.reduce((s, w) => s + (w.win_rate ?? 0), 0) / filtered.length
    : 0;

  return (
    <section id="page-weekly" className="page active">
      <div className="ph">
        <div>
          <div className="ph-label">Weekly</div>
          <h2 className="ph-title">Weekly <em>Review</em></h2>
          <p className="ph-sub">{filtered.length} minggu · read-only</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flt-bar">
        <div className="flt-dd-row">
          <div className="fg">
            <label className="flabel">Tahun</label>
            <div className="selwrap">
              <select className="fselect" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                <option value="">Semua</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">Bulan</label>
            <div className="selwrap">
              <select className="fselect" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="">Semua</option>
                {MONTHS_ID.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setFilterYear(''); setFilterMonth(''); }}
              style={{ alignSelf: 'flex-end' }}
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="scard"><div className="scard-lbl">Total Trade</div><div className="scard-val">{totalTrades}</div></div>
        <div className="scard"><div className="scard-lbl">Avg Win Rate</div><div className={`scard-val ${avgWR >= 50 ? 'green' : 'red'}`}>{avgWR.toFixed(1)}%</div></div>
        <div className="scard"><div className="scard-lbl">Total Win</div><div className="scard-val green">{totalWins}</div></div>
        <div className="scard"><div className="scard-lbl">Total P/L</div><div className={`scard-val ${totalPl >= 0 ? 'green' : 'red'}`}>{fmtPl(totalPl)}</div></div>
      </div>

      {/* Weekly list */}
      {filtered.length === 0 ? (
        <div className="ph-empty"><div className="ph-icon">📅</div><p>Belum ada weekly review.</p></div>
      ) : (
        <div className="box">
          <div className="box-head"><span className="box-title">Semua Weekly Review</span></div>
          <div className="box-body-0">
            <div className="stbl-scroll" style={{ maxHeight: 480 }}>
              <table className="stbl">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Trade</th>
                    <th>Win</th>
                    <th>Loss</th>
                    <th>Win Rate</th>
                    <th>P/L</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(w => {
                    const pnl = w.total_pnl ?? 0;
                    const wr  = w.win_rate ?? 0;
                    return (
                      <tr key={w.id}>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, whiteSpace: 'nowrap' }}>
                          {fmtDate(w.week_start)} – {fmtDate(w.week_end)}
                        </td>
                        <td>{w.total_trades ?? 0}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 700 }}>{w.wins ?? 0}</td>
                        <td style={{ color: 'var(--red)', fontWeight: 700 }}>{w.losses ?? 0}</td>
                        <td className={wr >= 50 ? 'pos-val' : 'neg-val'}>{wr.toFixed(1)}%</td>
                        <td className={pnl >= 0 ? 'pos-val' : 'neg-val'}>{fmtPl(pnl)}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.notes ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}