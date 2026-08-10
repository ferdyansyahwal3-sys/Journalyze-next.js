'use client';
/**
 * components/live/LivePageMonthly.tsx
 * Phase 10 — field Trade: tanggal, _pl, result, posisi, pair, sesi
 */

import { useState, useMemo } from 'react';
import type { Trade, MonthlyReview } from '../../lib/types';

interface Props {
  trades: Trade[];
  monthlyReviews: MonthlyReview[];
}

function fmtPl(n: number): string {
  return (n >= 0 ? '+' : '') + n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS_ID   = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7; // Mon=0 ... Sun=6
}

export function LivePageMonthly({ trades, monthlyReviews }: Props) {
  const now = new Date();

  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

  // Unique years dari tanggal trade (field: tanggal = 'YYYY-MM-DD')
  const years = useMemo(() => {
    const ys = new Set<number>();
    monthlyReviews.forEach(m => {
      const y = parseInt(m.month?.slice(0, 4) ?? '');
      if (!isNaN(y)) ys.add(y);
    });
    trades.forEach(t => {
      if (t.tanggal) ys.add(new Date(t.tanggal + 'T00:00:00').getFullYear());
    });
    ys.add(now.getFullYear());
    return Array.from(ys).sort().reverse();
  }, [monthlyReviews, trades]);

  const monthKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const review   = monthlyReviews.find(m => m.month?.startsWith(monthKey)) ?? null;

  // Trades untuk bulan terpilih — pakai t.tanggal
  const monthTrades = useMemo(() => {
    return trades.filter(t => {
      if (!t.tanggal) return false;
      return t.tanggal.startsWith(monthKey);
    });
  }, [trades, monthKey]);

  // Group by day
  const byDay = useMemo(() => {
    const map: Record<number, { pl: number; count: number }> = {};
    monthTrades.forEach(t => {
      const day = parseInt(t.tanggal.slice(8, 10));
      if (!map[day]) map[day] = { pl: 0, count: 0 };
      map[day].pl    += t._pl ?? 0;
      map[day].count += 1;
    });
    return map;
  }, [monthTrades]);

  // Calendar build
  const totalDays   = getDaysInMonth(selYear, selMonth);
  const firstOffset = getFirstDayOfWeek(selYear, selMonth);
  const isThisMonth = now.getFullYear() === selYear && now.getMonth() + 1 === selMonth;
  const today       = now.getDate();

  const totalCells = Math.ceil((firstOffset + totalDays) / 7) * 7;
  const cells: (number | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstOffset + 1;
    return day >= 1 && day <= totalDays ? day : null;
  });

  // Stats bulan terpilih
  const wins    = monthTrades.filter(t => t.result === 'Profit').length;
  const losses  = monthTrades.filter(t => t.result === 'Lose').length;
  const totalPl = monthTrades.reduce((s, t) => s + (t._pl ?? 0), 0);
  const wr      = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0;

  return (
    <section id="page-monthly" className="page active">
      <div className="ph">
        <div>
          <div className="ph-label">Monthly</div>
          <h2 className="ph-title">Monthly <em>Review</em></h2>
          <p className="ph-sub">{MONTHS_ID[selMonth - 1]} {selYear} · read-only</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flt-bar">
        <div className="flt-dd-row">
          <div className="fg">
            <label className="flabel">Tahun</label>
            <div className="selwrap">
              <select className="fselect" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">Bulan</label>
            <div className="selwrap">
              <select className="fselect" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
                {MONTHS_ID.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="scard"><div className="scard-lbl">Total Trade</div><div className="scard-val">{monthTrades.length}</div></div>
        <div className="scard"><div className="scard-lbl">Win Rate</div><div className={`scard-val ${wr >= 50 ? 'green' : 'red'}`}>{wr.toFixed(1)}%</div></div>
        <div className="scard">
          <div className="scard-lbl">Win / Loss</div>
          <div className="scard-val">
            <span style={{ color: 'var(--green)' }}>{wins}</span>{' / '}
            <span style={{ color: 'var(--red)' }}>{losses}</span>
          </div>
        </div>
        <div className="scard"><div className="scard-lbl">Total P/L</div><div className={`scard-val ${totalPl >= 0 ? 'green' : 'red'}`}>{fmtPl(totalPl)}</div></div>
      </div>

      {/* Calendar */}
      <div className="box">
        <div className="box-head">
          <span className="box-title">{MONTHS_ID[selMonth - 1]} {selYear}</span>
        </div>
        <div className="box-body">
          {/* Day headers */}
          <div className="mo-cal-grid" style={{ marginBottom: 4 }}>
            {DAY_HEADERS.map(d => (
              <div key={d} className="mo-day-hdr">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="mo-cal-scroll-wrap">
            <div className="mo-cal-grid">
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} className="mo-day-cell day-empty" />;
                const dayData  = byDay[day];
                const hasData  = !!dayData;
                const pl       = dayData?.pl ?? 0;
                const isToday  = isThisMonth && day === today;
                let cellClass  = 'mo-day-cell';
                if (hasData) {
                  cellClass += pl > 0 ? ' day-profit has-trade'
                             : pl < 0 ? ' day-lose has-trade'
                             : ' day-mixed has-trade';
                }
                if (isToday) cellClass += ' day-today';
                return (
                  <div key={idx} className={cellClass}>
                    <span className="mo-day-num">{day}</span>
                    {hasData && (
                      <>
                        <span className="mo-day-trade-count">{dayData.count} trade</span>
                        <span className={`mo-day-pl ${pl >= 0 ? 'pos' : 'neg'}`}>{fmtPl(pl)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Review notes */}
      {review?.notes && (
        <div className="box">
          <div className="box-head"><span className="box-title">Catatan Bulan Ini</span></div>
          <div className="box-body">
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.75 }}>{review.notes}</p>
          </div>
        </div>
      )}

      {/* Riwayat monthly */}
      {monthlyReviews.length > 0 && (
        <div className="box">
          <div className="box-head"><span className="box-title">Riwayat Monthly</span></div>
          <div className="box-body-0">
            <div className="stbl-scroll">
              <table className="stbl">
                <thead>
                  <tr><th>Bulan</th><th>Trade</th><th>Win</th><th>Loss</th><th>Win Rate</th><th>P/L</th></tr>
                </thead>
                <tbody>
                  {monthlyReviews.map(m => {
                    const pnl = m.total_pnl ?? 0;
                    const wrm = m.win_rate ?? 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{m.month ?? '-'}</td>
                        <td>{m.total_trades ?? 0}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 700 }}>{m.wins ?? 0}</td>
                        <td style={{ color: 'var(--red)', fontWeight: 700 }}>{m.losses ?? 0}</td>
                        <td className={wrm >= 50 ? 'pos-val' : 'neg-val'}>{wrm.toFixed(1)}%</td>
                        <td className={pnl >= 0 ? 'pos-val' : 'neg-val'}>{fmtPl(pnl)}</td>
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