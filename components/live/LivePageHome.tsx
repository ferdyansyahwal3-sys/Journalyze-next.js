'use client';
/**
 * components/live/LivePageHome.tsx
 * Phase 10
 * Field: _pl, result, posisi, tanggal, pair, sesi
 */

import type { Trade, WeeklyReview, MonthlyReview } from '../../lib/types';
import type { LiveProfile } from '../../lib/publicData';

interface Props {
  trades: Trade[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  profile: LiveProfile;
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPl(n: number): string {
  return (n >= 0 ? '+' : '') + fmt(n);
}

export function LivePageHome({ trades, weeklyReviews, monthlyReviews, profile }: Props) {
  const total    = trades.length;
  const wins     = trades.filter(t => t.result === 'Profit').length;
  const losses   = trades.filter(t => t.result === 'Lose').length;
  const be       = total - wins - losses;
  const totalPl  = trades.reduce((s, t) => s + (t._pl ?? 0), 0);
  const winRate  = total > 0 ? (wins / total) * 100 : 0;

  const winTrades = trades.filter(t => t.result === 'Profit' && t.rr);
  const avgRR = winTrades.length > 0
    ? winTrades.reduce((s, t) => s + (t.rr ?? 0), 0) / winTrades.length
    : 0;

  const sorted    = [...trades].sort((a, b) => (b._pl ?? 0) - (a._pl ?? 0));
  const bestTrade = sorted[0] ?? null;
  const worstTrade = sorted[sorted.length - 1] ?? null;
  const recent    = trades.slice(0, 5);

  return (
    <section id="page-home" className="page active">
      <div className="ph">
        <div>
          <div className="ph-label">Live Journal</div>
          <h1 className="ph-title">Ringkasan <em>Trading</em></h1>
          <p className="ph-sub">
            Journal milik <strong>{profile.display_name ?? 'Trader'}</strong> · read-only · data real-time
          </p>
        </div>
      </div>

      {/* Stat row 1 */}
      <div className="stat-row ai-anim d1">
        <div className="scard">
          <div className="scard-lbl">Total Trade</div>
          <div className="scard-val">{total}</div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Win Rate</div>
          <div className={`scard-val ${winRate >= 50 ? 'green' : 'red'}`}>
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Total P/L</div>
          <div className={`scard-val ${totalPl >= 0 ? 'green' : 'red'}`}>
            {fmtPl(totalPl)}
          </div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Avg RR</div>
          <div className="scard-val">{avgRR > 0 ? fmt(avgRR) : '-'}</div>
        </div>
      </div>

      {/* Stat row 2 */}
      <div className="stat-row ai-anim d2">
        <div className="scard">
          <div className="scard-lbl">Win</div>
          <div className="scard-val green">{wins}</div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Loss</div>
          <div className="scard-val red">{losses}</div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Break Even</div>
          <div className="scard-val">{be}</div>
        </div>
        <div className="scard">
          <div className="scard-lbl">Weekly Reviews</div>
          <div className="scard-val">{weeklyReviews.length}</div>
        </div>
      </div>

      {/* Grid: best/worst + 5 terakhir */}
      <div className="g2 ai-anim d3">
        <div className="box">
          <div className="box-head">
            <span className="box-title">Best &amp; Worst Trade</span>
          </div>
          <div className="box-body-0">
            <table className="rtable">
              <tbody>
                <tr>
                  <td className="lbl">Best Trade</td>
                  <td className={`val ${(bestTrade?._pl ?? 0) >= 0 ? 'green' : 'red'}`}>
                    {bestTrade ? `${bestTrade.pair} ${fmtPl(bestTrade._pl ?? 0)}` : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">Worst Trade</td>
                  <td className={`val ${(worstTrade?._pl ?? 0) >= 0 ? 'green' : 'red'}`}>
                    {worstTrade ? `${worstTrade.pair} ${fmtPl(worstTrade._pl ?? 0)}` : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">Total Win P&L</td>
                  <td className="val green">
                    {fmtPl(trades.filter(t => t.result === 'Profit').reduce((s, t) => s + (t._pl ?? 0), 0))}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">Total Loss P&L</td>
                  <td className="val red">
                    {fmtPl(trades.filter(t => t.result === 'Lose').reduce((s, t) => s + (t._pl ?? 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <div className="box-head">
            <span className="box-title">5 Trade Terakhir</span>
          </div>
          <div className="box-body-0">
            {recent.length === 0 ? (
              <div className="ph-empty"><div className="ph-icon">📋</div><p>Belum ada trade</p></div>
            ) : (
              <div className="stbl-scroll">
                <table className="stbl">
                  <thead>
                    <tr><th>Pair</th><th>Posisi</th><th>P/L</th></tr>
                  </thead>
                  <tbody>
                    {recent.map(t => (
                      <tr key={t.id}>
                        <td>{t.pair || '-'}</td>
                        <td>
                          <span className={`chip chip-${(t.posisi || '').toLowerCase() === 'buy' ? 'buy' : 'sell'}`}>
                            {t.posisi || '-'}
                          </span>
                        </td>
                        <td className={`${(t._pl ?? 0) >= 0 ? 'pos-val' : 'neg-val'}`}
                            style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {t._pl != null ? fmtPl(t._pl) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly overview */}
      {monthlyReviews.length > 0 && (
        <div className="box ai-anim d4">
          <div className="box-head"><span className="box-title">Monthly Overview</span></div>
          <div className="box-body-0">
            <div className="stbl-scroll">
              <table className="stbl">
                <thead>
                  <tr><th>Bulan</th><th>Trade</th><th>Win Rate</th><th>P/L</th></tr>
                </thead>
                <tbody>
                  {monthlyReviews.slice(0, 6).map(m => {
                    const pnl = m.total_pnl ?? 0;
                    const wr  = m.win_rate ?? 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{m.month ?? '-'}</td>
                        <td>{m.total_trades ?? 0}</td>
                        <td className={wr >= 50 ? 'pos-val' : 'neg-val'}>{wr.toFixed(1)}%</td>
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