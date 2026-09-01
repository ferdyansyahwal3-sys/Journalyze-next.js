'use client'
// components/live/LivePublicView.tsx
// Tampilan read-only statistik trading untuk halaman publik /live/[token]
// Client component supaya bisa pakai Chart.js

import { useMemo } from 'react'

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
  result: string   // 'Profit' | 'Lose'
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
  const total  = trades.length
  const wins   = trades.filter(t => t.result === 'Profit').length
  const losses = trades.filter(t => t.result === 'Lose').length
  const be     = trades.filter(t => t.result === 'BE' || t.result === 'BE').length
  const winrate = total > 0 ? (wins / total) * 100 : 0
  const totalPnl = trades.reduce((acc, t) => acc + (t.pl || 0), 0)
  const avgWin   = wins > 0
    ? trades.filter(t => t.result === 'Profit').reduce((a, t) => a + (t.pl || 0), 0) / wins
    : 0
  const avgLoss  = losses > 0
    ? Math.abs(trades.filter(t => t.result === 'Lose').reduce((a, t) => a + (t.pl || 0), 0) / losses)
    : 0
  const rr = avgLoss > 0 ? avgWin / avgLoss : 0

  // Equity curve (kumulatif)
  const equity: number[] = []
  let running = 0
  ;[...trades].reverse().forEach(t => {
    running += (t.pl || 0)
    equity.push(running)
  })

  return { total, wins, losses, be, winrate, totalPnl, avgWin, avgLoss, rr, equity }
}

function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LivePublicView({ trades, shareToken, config }: Props) {
  const stats = useMemo(() => calcStats(trades), [trades])
  const recentTrades = trades.slice(0, 20)

  return (
    <div className="lpv-root">

      {/* ── Brand header ─────────────────────────────── */}
      <header className="lpv-header">
        <div className="lpv-brand">
          <span className="lpv-live-badge">● LIVE</span>
          <span className="lpv-brand-name">Journalyze</span>
        </div>
        <p className="lpv-subtitle">Trading Journal — Statistik Publik</p>
      </header>

      {/* ── Summary cards ───────────────────────────── */}
      <section className="lpv-section">
        <div className="lpv-cards">
          <StatCard label="Total Trade" value={String(stats.total)} />
          <StatCard
            label="Total PnL"
            value={(stats.totalPnl >= 0 ? '+' : '') + fmtNum(stats.totalPnl)}
            accent={stats.totalPnl >= 0 ? 'green' : 'red'}
          />
          {config.showWinrate && (
            <StatCard
              label="Win Rate"
              value={fmtNum(stats.winrate, 1) + '%'}
              accent={stats.winrate >= 50 ? 'green' : 'red'}
            />
          )}
          <StatCard
            label="Risk Reward"
            value={'1 : ' + fmtNum(stats.rr, 2)}
            accent={stats.rr >= 1 ? 'green' : 'neutral'}
          />
          <StatCard label="Win" value={String(stats.wins)} accent="green" />
          <StatCard label="Loss" value={String(stats.losses)} accent="red" />
        </div>
      </section>

      {/* ── Equity curve (inline sparkline via SVG) ── */}
      {config.showEquity && stats.equity.length > 1 && (
        <section className="lpv-section">
          <h2 className="lpv-section-title">Equity Curve</h2>
          <div className="lpv-equity-wrap">
            <EquitySvg points={stats.equity} />
          </div>
        </section>
      )}

      {/* ── Recent trades table ───────────────────── */}
      {config.showTrades && recentTrades.length > 0 && (
        <section className="lpv-section">
          <h2 className="lpv-section-title">20 Trade Terakhir</h2>
          <div className="lpv-table-wrap">
            <table className="lpv-table">
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
                {recentTrades.map(t => (
                  <tr key={t.id}>
                    <td>{t.tanggal}</td>
                    <td>{t.pair}</td>
                    <td className={t.posisi === 'Buy' ? 'text-green' : 'text-red'}>{t.posisi}</td>
                    <td>{t.lot}</td>
                    <td className={(t.pl || 0) >= 0 ? 'text-green' : 'text-red'}>
                      {((t.pl || 0) >= 0 ? '+' : '') + fmtNum(t.pl || 0)}
                    </td>
                    <td>
                      <span className={`lpv-result-badge result-${t.result === 'Profit' ? 'win' : t.result === 'Lose' ? 'loss' : 'be'}`}>
                        {t.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Footer watermark ─────────────────────── */}
      <footer className="lpv-footer">
        <span>Powered by </span>
        <strong>Journalyze</strong>
        <span className="lpv-footer-dot">·</span>
        <span className="lpv-footer-token">#{shareToken.slice(-6)}</span>
      </footer>

      {/* ── Styles ───────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .lpv-root {
          min-height: 100vh;
          background: var(--bg-main, #0f0f1a);
          color: var(--text-primary, #e0e0e0);
          font-family: var(--font-body, 'Inter', sans-serif);
          padding: 0 0 40px;
        }

        /* Header */
        .lpv-header {
          background: var(--bg-card, #1a1a2e);
          border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
          padding: 20px 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .lpv-brand { display: flex; align-items: center; gap: 10px; }
        .lpv-live-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          border-radius: 20px;
          padding: 2px 8px;
          animation: livePulse 2s infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        .lpv-brand-name { font-size: 20px; font-weight: 700; }
        .lpv-subtitle   { font-size: 12px; color: var(--text-secondary, #9ca3af); margin: 0; }

        /* Section */
        .lpv-section { padding: 24px 24px 0; }
        .lpv-section-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary, #9ca3af);
          margin: 0 0 14px;
        }

        /* Stat Cards */
        .lpv-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .lpv-stat-card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: 10px;
          padding: 14px 16px;
        }
        .lpv-stat-label {
          font-size: 11px;
          color: var(--text-secondary, #9ca3af);
          margin-bottom: 6px;
          font-weight: 500;
        }
        .lpv-stat-value {
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
        }
        .lpv-stat-value.accent-green  { color: #22c55e; }
        .lpv-stat-value.accent-red    { color: #f87171; }
        .lpv-stat-value.accent-neutral { color: var(--text-primary, #e0e0e0); }

        /* Equity */
        .lpv-equity-wrap {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: 10px;
          padding: 16px;
          overflow: hidden;
        }

        /* Table */
        .lpv-table-wrap { overflow-x: auto; }
        .lpv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .lpv-table th {
          text-align: left;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary, #9ca3af);
          border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
          white-space: nowrap;
        }
        .lpv-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: var(--text-primary, #e0e0e0);
          white-space: nowrap;
        }
        .lpv-table tr:last-child td { border-bottom: none; }
        .lpv-table tr:hover td { background: rgba(255,255,255,0.03); }

        .text-green { color: #22c55e; }
        .text-red   { color: #f87171; }

        .lpv-result-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: 0.06em;
        }
        .result-win  { background: rgba(34,197,94,0.15);  color: #22c55e; }
        .result-loss { background: rgba(248,113,113,0.15); color: #f87171; }
        .result-be   { background: rgba(234,179,8,0.15);  color: #eab308; }

        /* Footer */
        .lpv-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .lpv-footer strong { color: var(--text-primary, #9ca3af); }
        .lpv-footer-dot    { opacity: 0.4; }
        .lpv-footer-token  { font-family: monospace; opacity: 0.4; }

        @media (max-width: 480px) {
          .lpv-section { padding: 20px 16px 0; }
          .lpv-header  { padding: 16px; }
          .lpv-cards   { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = 'neutral' }: {
  label:   string
  value:   string
  accent?: 'green' | 'red' | 'neutral'
}) {
  return (
    <div className="lpv-stat-card">
      <div className="lpv-stat-label">{label}</div>
      <div className={`lpv-stat-value accent-${accent}`}>{value}</div>
    </div>
  )
}

// SVG sparkline equity curve (no external lib needed)
function EquitySvg({ points }: { points: number[] }) {
  const W = 600, H = 120, PAD = 10
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const ys = points.map(p => PAD + (1 - (p - min) / range) * (H - PAD * 2))

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const areaPath = `${linePath} L${xs[xs.length - 1]},${H - PAD} L${xs[0]},${H - PAD} Z`

  const lastY    = ys[ys.length - 1]
  const isProfit = points[points.length - 1] >= 0
  const color    = isProfit ? '#22c55e' : '#f87171'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100px', display: 'block' }}
    >
      <defs>
        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill="url(#eq-grad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={xs[xs.length - 1]} cy={lastY} r="4" fill={color} />
    </svg>
  )
}