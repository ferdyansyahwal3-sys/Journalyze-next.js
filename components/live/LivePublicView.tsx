'use client'
// components/live/LivePublicView.tsx — REDESIGN TOTAL
// Design system identik dengan journal: Cormorant + Outfit + JetBrains Mono
// CSS vars dari live.css (--bg, --gold, --green, --red, --border, dst)

import { useMemo, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string
  tanggal: string
  pair: string
  posisi: string
  lot: number
  entry?: number
  close?: number
  pl?: number
  result: string
  catatan?: string
}

interface Config {
  showTrades:  boolean
  showEquity:  boolean
  showWinrate: boolean
  showPlan:    boolean
}

interface Props {
  trades:     Trade[]
  shareToken: string
  config:     Config
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcStats(trades: Trade[]) {
  const total   = trades.length
  const wins    = trades.filter(t => t.result === 'Profit').length
  const losses  = trades.filter(t => t.result === 'Lose').length
  const winrate = total > 0 ? (wins / total) * 100 : 0

  const totalPnl = trades.reduce((acc, t) => acc + (t.pl || 0), 0)

  const winTrades  = trades.filter(t => t.result === 'Profit')
  const lossTrades = trades.filter(t => t.result === 'Lose')

  const avgWin  = winTrades.length > 0
    ? winTrades.reduce((a, t) => a + (t.pl || 0), 0) / winTrades.length : 0
  const avgLoss = lossTrades.length > 0
    ? Math.abs(lossTrades.reduce((a, t) => a + (t.pl || 0), 0) / lossTrades.length) : 0
  const rr = avgLoss > 0 ? avgWin / avgLoss : 0

  // Best & Worst
  const bestTrade  = trades.reduce((best, t) =>
    (t.pl || 0) > (best?.pl || -Infinity) ? t : best, null as Trade | null)
  const worstTrade = trades.reduce((worst, t) =>
    (t.pl || 0) < (worst?.pl || Infinity) ? t : worst, null as Trade | null)

  // Streak
  let streak = 0
  let streakType: 'win' | 'loss' | null = null
  for (const t of trades) {
    if (t.result === 'Profit') {
      if (streakType === 'win') streak++
      else { streakType = 'win'; streak = 1 }
    } else if (t.result === 'Lose') {
      if (streakType === 'loss') streak++
      else { streakType = 'loss'; streak = 1 }
    } else break
  }

  // Pair breakdown
  const pairMap: Record<string, number> = {}
  trades.forEach(t => { pairMap[t.pair] = (pairMap[t.pair] || 0) + 1 })
  const pairs = Object.entries(pairMap)
    .sort((a, b) => b[1] - a[1])
    .map(([pair, count]) => ({ pair, count, pct: total > 0 ? (count / total) * 100 : 0 }))

  // Equity curve (kumulatif, oldest→newest)
  const equity: number[] = []
  let running = 0
  ;[...trades].reverse().forEach(t => {
    running += (t.pl || 0)
    equity.push(running)
  })

  return {
    total, wins, losses, winrate, totalPnl,
    avgWin, avgLoss, rr,
    bestTrade, worstTrade,
    streak, streakType,
    pairs, equity,
  }
}

function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function fmtPnl(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n)
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LivePublicView({ trades, shareToken, config }: Props) {
  const stats        = useMemo(() => calcStats(trades), [trades])
  const recentTrades = trades.slice(0, 20)
  const [now, setNow] = useState('')

  useEffect(() => {
    const fmt = () => {
      const d = new Date()
      setNow(d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
      }) + ' · ' + d.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit',
      }))
    }
    fmt()
    const t = setInterval(fmt, 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="live-view lv-root">

      {/* ── TOPBAR ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="brand-logo">
            Journal<em>yze</em>
          </span>
          <span className="brand-tag">Live</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: 'var(--text3)',
            letterSpacing: '1px',
          }}>
            {now}
          </span>
          <span className="live-badge">Live</span>
        </div>
      </header>

      {/* ── READONLY BAR ───────────────────────────────────────────── */}
      <div className="live-readonly-bar">
        <span style={{ color: 'var(--gold)', opacity: .5 }}>◆</span>
        Statistik Publik — Read-only View
        <span style={{ color: 'var(--gold)', opacity: .5 }}>◆</span>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <main className="main" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Page header */}
        <div className="ph">
          <div>
            <div className="ph-label">Trading Journal</div>
            <h1 className="ph-title">
              Live <em>Statistics</em>
            </h1>
            <p className="ph-sub">
              Snapshot publik · {stats.total} total trade tercatat
            </p>
          </div>
        </div>

        {/* ── STAT CARDS ─────────────────────────────────────────── */}
        <div className="stat-row lv-anim d1" style={{ gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 12 }}>
          <SCard label="Total Trade" value={String(stats.total)} />
          <SCard
            label="Total PnL"
            value={fmtPnl(stats.totalPnl)}
            cls={stats.totalPnl >= 0 ? 'green' : 'red'}
          />
          {config.showWinrate && (
            <SCard
              label="Win Rate"
              value={fmtNum(stats.winrate, 1) + '%'}
              cls={stats.winrate >= 50 ? 'green' : 'red'}
            />
          )}
          <SCard
            label="Risk Reward"
            value={'1 : ' + fmtNum(stats.rr, 2)}
          />
          <SCard label="Win" value={String(stats.wins)} cls="green" />
          <SCard label="Loss" value={String(stats.losses)} cls="red" />
        </div>

        {/* ── STREAK + BEST/WORST ────────────────────────────────── */}
        <div className="lv-highlight-row lv-anim d2">
          {/* Streak */}
          <div className="box" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 0 }}>
            <div>
              <div className="lv-micro-label">Current Streak</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 20 }}>
                  {stats.streakType === 'win' ? '🔥' : stats.streakType === 'loss' ? '❄️' : '—'}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  color: stats.streakType === 'win'
                    ? 'var(--green)'
                    : stats.streakType === 'loss'
                      ? 'var(--red)'
                      : 'var(--text3)',
                }}>
                  {stats.streak > 0 ? `${stats.streak}${stats.streakType === 'win' ? 'W' : 'L'}` : '—'}
                </span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />
            <div>
              <div className="lv-micro-label">Win / Loss</div>
              <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                  {stats.wins}W
                </span>
                <span style={{ color: 'var(--text4)', fontSize: 10 }}>/</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                  {stats.losses}L
                </span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />
            <div>
              <div className="lv-micro-label">Avg Win / Avg Loss</div>
              <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                  {fmtPnl(stats.avgWin)}
                </span>
                <span style={{ color: 'var(--text4)', fontSize: 10 }}>/</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                  -{fmtNum(stats.avgLoss)}
                </span>
              </div>
            </div>
          </div>

          {/* Best trade */}
          {stats.bestTrade && (
            <div className="box lv-highlight-card lv-highlight-best" style={{ marginBottom: 0 }}>
              <div className="lv-micro-label" style={{ color: 'var(--green)', marginBottom: 8 }}>
                ▲ Best Trade
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                {fmtPnl(stats.bestTrade.pl || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {stats.bestTrade.pair} · {stats.bestTrade.tanggal}
              </div>
            </div>
          )}

          {/* Worst trade */}
          {stats.worstTrade && (
            <div className="box lv-highlight-card lv-highlight-worst" style={{ marginBottom: 0 }}>
              <div className="lv-micro-label" style={{ color: 'var(--red)', marginBottom: 8 }}>
                ▼ Worst Trade
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                {fmtPnl(stats.worstTrade.pl || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {stats.worstTrade.pair} · {stats.worstTrade.tanggal}
              </div>
            </div>
          )}
        </div>

        {/* ── EQUITY + PAIR BREAKDOWN ────────────────────────────── */}
        <div className="lv-anim d3" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, marginBottom: 14 }}>

          {/* Equity curve */}
          {config.showEquity && stats.equity.length > 1 && (
            <div className="box" style={{ marginBottom: 0 }}>
              <div className="box-head">
                <span className="box-title">Equity Curve</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700,
                }}>
                  {fmtPnl(stats.totalPnl)}
                </span>
              </div>
              <div className="box-body box-body-0" style={{ padding: '12px 18px 16px' }}>
                <EquitySvg points={stats.equity} />
              </div>
            </div>
          )}

          {/* Pair breakdown */}
          {stats.pairs.length > 0 && (
            <div className="box" style={{ marginBottom: 0 }}>
              <div className="box-head">
                <span className="box-title">Pair Distribution</span>
              </div>
              <div className="box-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.pairs.slice(0, 6).map(({ pair, count, pct }) => (
                  <div key={pair}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--gold2)',
                      }}>{pair}</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: 'var(--text3)',
                      }}>{count} · {fmtNum(pct, 1)}%</span>
                    </div>
                    <div style={{
                      height: 4,
                      background: 'var(--bg4)',
                      borderRadius: 99,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--gold)',
                        borderRadius: 99,
                        transition: 'width .6s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TRADE TABLE ────────────────────────────────────────── */}
        {config.showTrades && recentTrades.length > 0 && (
          <div className="box lv-anim d4" style={{ marginBottom: 0 }}>
            <div className="box-head">
              <span className="box-title">20 Trade Terakhir</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: 'var(--text3)',
              }}>Read-only</span>
            </div>
            <div className="tbl-scroll box-body-0">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Pair</th>
                    <th>Tipe</th>
                    <th>Lot</th>
                    <th>PnL</th>
                    <th>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map(t => {
                    const pnl = t.pl || 0
                    return (
                      <tr key={t.id}>
                        <td style={{ color: 'var(--text2)' }}>{t.tanggal}</td>
                        <td style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          color: 'var(--gold2)',
                        }}>{t.pair}</td>
                        <td>
                          <span className={t.posisi === 'Buy' ? 'chip chip-buy' : 'chip chip-sell'}>
                            {t.posisi}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text2)' }}>{t.lot}</td>
                        <td className={pnl >= 0 ? 'pos-val' : 'neg-val'}>
                          {fmtPnl(pnl)}
                        </td>
                        <td>
                          <span className={
                            t.result === 'Profit' ? 'chip chip-profit'
                            : t.result === 'Lose'  ? 'chip chip-lose'
                            : 'chip chip-gold'
                          }>
                            {t.result}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer style={{
          marginTop: 48,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--gold2)',
          }}>
            Journal<em style={{ fontStyle: 'italic', color: 'var(--gold3)' }}>yze</em>
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            letterSpacing: 2,
            textTransform: 'uppercase' as const,
            color: 'var(--text3)',
          }}>
            Public Live View · #{shareToken.slice(-6)}
          </span>
        </footer>

      </main>

      {/* ── EXTRA STYLES ───────────────────────────────────────────── */}
      <style>{`
        .lv-root {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
        }

        /* highlight row */
        .lv-highlight-row {
          display: grid;
          grid-template-columns: 1fr 180px 180px;
          gap: 10px;
          margin-bottom: 14px;
        }

        /* best/worst cards */
        .lv-highlight-card {
          padding: 14px 16px;
        }
        .lv-highlight-best {
          border-color: var(--green-bd);
          background: var(--green-bg);
        }
        .lv-highlight-worst {
          border-color: var(--red-bd);
          background: var(--red-bg);
        }

        /* micro label */
        .lv-micro-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 7.5px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text3);
        }

        /* anim */
        .lv-anim {
          opacity: 0;
          transform: translateY(8px);
          animation: lv-fadeup .4s ease forwards;
        }
        @keyframes lv-fadeup {
          to { opacity: 1; transform: none; }
        }
        .lv-anim.d1 { animation-delay: .05s; }
        .lv-anim.d2 { animation-delay: .12s; }
        .lv-anim.d3 { animation-delay: .19s; }
        .lv-anim.d4 { animation-delay: .26s; }

        /* table overrides for live */
        .lv-root .tbl-scroll {
          max-height: none;
          border-radius: 0;
          border: none;
          border-top: 1px solid var(--border);
        }
        .lv-root .dtable {
          min-width: 580px;
        }

        /* responsive */
        @media (max-width: 768px) {
          .lv-highlight-row {
            grid-template-columns: 1fr;
          }
          .lv-root .lv-anim + div {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .stat-row {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SCard({ label, value, cls }: {
  label: string
  value: string
  cls?: 'green' | 'red'
}) {
  return (
    <div className="scard">
      <div className="scard-lbl">{label}</div>
      <div className={`scard-val${cls ? ' ' + cls : ''}`}>{value}</div>
    </div>
  )
}

// SVG Equity Curve — styled sesuai tema journal (gold line, gradient fill)
function EquitySvg({ points }: { points: number[] }) {
  const W = 800, H = 140, PADX = 8, PADY = 16
  const min   = Math.min(...points, 0)
  const max   = Math.max(...points, 0)
  const range = max - min || 1

  const xs = points.map((_, i) =>
    PADX + (i / Math.max(points.length - 1, 1)) * (W - PADX * 2))
  const ys = points.map(p =>
    PADY + (1 - (p - min) / range) * (H - PADY * 2))

  const zero_y = PADY + (1 - (0 - min) / range) * (H - PADY * 2)

  const linePath = xs.map((x, i) =>
    `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xs[xs.length-1].toFixed(1)},${zero_y.toFixed(1)} L${xs[0].toFixed(1)},${zero_y.toFixed(1)} Z`

  const last     = points[points.length - 1]
  const isProfit = last >= 0
  const color    = isProfit ? 'var(--green)' : 'var(--red)'
  const gradId   = isProfit ? 'lv-grad-g' : 'lv-grad-r'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 130, display: 'block' }}
    >
      <defs>
        <linearGradient id="lv-grad-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--green)" stopOpacity=".18" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0"   />
        </linearGradient>
        <linearGradient id="lv-grad-r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--red)" stopOpacity=".18" />
          <stop offset="100%" stopColor="var(--red)" stopOpacity="0"   />
        </linearGradient>
      </defs>

      {/* Zero line */}
      <line
        x1={PADX} y1={zero_y} x2={W - PADX} y2={zero_y}
        stroke="var(--border)" strokeWidth="1" strokeDasharray="3,4"
      />

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last dot */}
      <circle
        cx={xs[xs.length-1]} cy={ys[ys.length-1]}
        r="4" fill={color}
      />
      <circle
        cx={xs[xs.length-1]} cy={ys[ys.length-1]}
        r="7" fill={color} fillOpacity=".15"
      />
    </svg>
  )
}