'use client';
/**
 * components/live/LivePageData.tsx
 * Phase 10 — Tabel trade read-only
 * Field sesuai lib/types.ts: _pl, posisi, tanggal, entry, close, sl, tp, lot, rr, sesi, metode/strategi
 */

import type { Trade } from '../../lib/types';

interface Props {
  trades: Trade[];
}

function fmtDate(s?: string | null): string {
  if (!s) return '-';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return s; }
}

function fmtNum(n?: number | null, d = 2): string {
  if (n == null) return '-';
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPl(n?: number | null): string {
  if (n == null) return '-';
  return (n >= 0 ? '+' : '') + fmtNum(n);
}

export function LivePageData({ trades }: Props) {
  return (
    <section id="page-data" className="page active">
      <div className="ph">
        <div>
          <div className="ph-label">Data</div>
          <h2 className="ph-title">Semua <em>Trade</em></h2>
          <p className="ph-sub">{trades.length} trade · read-only</p>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="ph-empty">
          <div className="ph-icon">📋</div>
          <p>Belum ada data trade.</p>
        </div>
      ) : (
        <div className="tbl-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Sesi</th>
                <th>Pair</th>
                <th>Posisi</th>
                <th>Lot</th>
                <th>Entry</th>
                <th>SL</th>
                <th>TP</th>
                <th>Close</th>
                <th>Result</th>
                <th>Pips</th>
                <th>P/L</th>
                <th>RR</th>
                <th>Strategi</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const pl     = t._pl ?? 0;
                const isWin  = t.result === 'Profit';
                const isLoss = t.result === 'Lose';
                const posLow = (t.posisi ?? '').toLowerCase();

                return (
                  <tr key={t.id}>
                    <td className="no">{i + 1}</td>
                    <td className="str" style={{ fontSize: '10px' }}>{fmtDate(t.tanggal)}</td>
                    <td>
                      <span className="chip chip-blue">{t.sesi || '-'}</span>
                    </td>
                    <td className="str">{t.pair || '-'}</td>
                    <td>
                      <span className={`chip chip-${posLow === 'buy' ? 'buy' : 'sell'}`}>
                        {t.posisi || '-'}
                      </span>
                    </td>
                    <td>{fmtNum(t.lot, 2)}</td>
                    <td>{fmtNum(t.entry, 5)}</td>
                    <td style={{ color: 'var(--red)' }}>{fmtNum(t.sl, 5)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmtNum(t.tp, 5)}</td>
                    <td>{fmtNum(t.close, 5)}</td>
                    <td>
                      <span className={`chip ${isWin ? 'chip-profit' : isLoss ? 'chip-lose' : 'chip-gold'}`}>
                        {t.result || '-'}
                      </span>
                    </td>
                    <td>{t.pips != null ? Math.abs(t.pips).toFixed(2) : '-'}</td>
                    <td className={pl > 0 ? 'pos-val' : pl < 0 ? 'neg-val' : ''}>
                      {t._pl != null ? fmtPl(t._pl) : '-'}
                    </td>
                    <td>{fmtNum(t.rr, 2)}</td>
                    <td style={{ fontSize: '9px' }}>
                      {(t.metode || t.strategi) ? (
                        <span className="chip chip-gold" style={{ fontSize: '7.5px' }}>
                          {t.metode || t.strategi}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}