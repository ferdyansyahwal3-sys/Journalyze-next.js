'use client'
// components/live/LivePublicView.tsx — v3
// Fix: responsive mobile/tablet/desktop + equity curve interaktif dengan tooltip

import { useMemo, useEffect, useState, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string
  tanggal: string
  pair: string
  posisi: string
  lot: number
  entry?: number
  close_price?: number
  pl_idr?: number
  result: string
  catatan?: string
  rr?: number
  pips?: number
  sesi?: string
  strategi?: string[]
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
  const totalPnl = trades.reduce((acc, t) => acc + (t.pl_idr || 0), 0)

  const winTrades  = trades.filter(t => t.result === 'Profit')
  const lossTrades = trades.filter(t => t.result === 'Lose')

  const avgWin  = winTrades.length > 0
    ? winTrades.reduce((a, t) => a + (t.pl_idr || 0), 0) / winTrades.length : 0
  const avgLoss = lossTrades.length > 0
    ? Math.abs(lossTrades.reduce((a, t) => a + (t.pl_idr || 0), 0) / lossTrades.length) : 0
  const rr = avgLoss > 0 ? avgWin / avgLoss : 0

  const bestTrade  = winTrades.length > 0
    ? winTrades.reduce((b, t) => (t.pl_idr || 0) > (b.pl_idr || 0) ? t : b) : null
  const worstTrade = lossTrades.length > 0
    ? lossTrades.reduce((w, t) => (t.pl_idr || 0) < (w.pl_idr || 0) ? t : w) : null

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

  // Equity curve oldest→newest dengan label tanggal
  const equity: { value: number; tanggal: string; index: number }[] = []
  let running = 0
  ;[...trades].reverse().forEach((t, i) => {
    running += (t.pl_idr || 0)
    equity.push({ value: running, tanggal: t.tanggal, index: i })
  })

  return { total, wins, losses, winrate, totalPnl, avgWin, avgLoss, rr, bestTrade, worstTrade, streak, streakType, pairs, equity }
}

function fmtIdr(n: number): string {
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })
}
function fmtPnl(n: number): string {
  return (n >= 0 ? '+' : '-') + fmtIdr(n)
}
function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Equity Chart dengan tooltip interaktif ────────────────────────────────────

interface TooltipState {
  x: number
  y: number
  value: number
  tanggal: string
  visible: boolean
}

function EquityChart({ equity }: { equity: { value: number; tanggal: string; index: number }[] }) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, value: 0, tanggal: '', visible: false })
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const points  = equity.map(e => e.value)
  const W = 800, H = 160, PADX = 12, PADY = 20

  const min   = Math.min(...points, 0)
  const max   = Math.max(...points, 0)
  const range = max - min || 1

  const xs = points.map((_, i) => PADX + (i / Math.max(points.length - 1, 1)) * (W - PADX * 2))
  const ys = points.map(p => PADY + (1 - (p - min) / range) * (H - PADY * 2))
  const zero_y = Math.min(H - PADY, Math.max(PADY, PADY + (1 - (0 - min) / range) * (H - PADY * 2)))

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xs[xs.length-1].toFixed(1)},${zero_y.toFixed(1)} L${xs[0].toFixed(1)},${zero_y.toFixed(1)} Z`

  const isProfit = points[points.length - 1] >= 0
  const color    = isProfit ? 'var(--green)' : 'var(--red)'

  // Reduced dot interval so not every point shows a dot (only every N-th)
  const DOT_INTERVAL = Math.max(1, Math.floor(points.length / 40))

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W

    // Find closest point
    let closest = 0
    let minDist = Infinity
    xs.forEach((x, i) => {
      const d = Math.abs(x - mouseX)
      if (d < minDist) { minDist = d; closest = i }
    })

    const svgX = xs[closest]
    const svgY = ys[closest]
    // Convert SVG coords to % for tooltip positioning
    const pctX = (svgX / W) * 100
    const pctY = (svgY / H) * 100

    setActiveIdx(closest)
    setTooltip({
      x: pctX,
      y: pctY,
      value: equity[closest].value,
      tanggal: equity[closest].tanggal,
      visible: true,
    })
  }, [xs, ys, equity])

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg || !e.touches[0]) return
    const rect = svg.getBoundingClientRect()
    const touchX = ((e.touches[0].clientX - rect.left) / rect.width) * W

    let closest = 0
    let minDist = Infinity
    xs.forEach((x, i) => {
      const d = Math.abs(x - touchX)
      if (d < minDist) { minDist = d; closest = i }
    })

    const svgX = xs[closest]
    const svgY = ys[closest]
    setActiveIdx(closest)
    setTooltip({
      x: (svgX / W) * 100,
      y: (svgY / H) * 100,
      value: equity[closest].value,
      tanggal: equity[closest].tanggal,
      visible: true,
    })
  }, [xs, ys, equity])

  const hideTooltip = () => { setTooltip(t => ({ ...t, visible: false })); setActiveIdx(null) }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 150, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={hideTooltip}
        onTouchMove={handleTouchMove}
        onTouchEnd={hideTooltip}
      >
        <defs>
          <linearGradient id="ec-grad-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--green)" stopOpacity=".2" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ec-grad-r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--red)" stopOpacity=".2" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zero baseline */}
        <line
          x1={PADX} y1={zero_y} x2={W - PADX} y2={zero_y}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="4,5"
        />

        {/* Area fill */}
        <path d={areaPath} fill={isProfit ? 'url(#ec-grad-g)' : 'url(#ec-grad-r)'} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data dots — setiap N titik */}
        {xs.map((x, i) => {
          if (i % DOT_INTERVAL !== 0 && i !== xs.length - 1 && i !== activeIdx) return null
          const isActive = i === activeIdx
          return (
            <g key={i}>
              <circle
                cx={x} cy={ys[i]}
                r={isActive ? 6 : 3}
                fill={isActive ? color : 'var(--bg2)'}
                stroke={color}
                strokeWidth={isActive ? 2 : 1.5}
                style={{ transition: 'r .1s' }}
              />
            </g>
          )
        })}

        {/* Vertical crosshair line saat hover */}
        {tooltip.visible && activeIdx !== null && (
          <line
            x1={xs[activeIdx]} y1={PADY}
            x2={xs[activeIdx]} y2={H - PADY}
            stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity=".5"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(tooltip.x, 8), 72)}%`,
            top: `${Math.max(0, tooltip.y - 18)}%`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg3)',
            border: `1px solid ${isProfit ? 'var(--green-bd)' : 'var(--red-bd)'}`,
            borderRadius: 7,
            padding: '6px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow2)',
          }}
        >
          <div style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            fontWeight: 700,
            color: tooltip.value >= 0 ? 'var(--green)' : 'var(--red)',
            marginBottom: 2,
          }}>
            {fmtPnl(tooltip.value)}
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 9,
            color: 'var(--text3)',
          }}>
            {tooltip.tanggal}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LivePublicView({ trades, shareToken, config }: Props) {
  const stats        = useMemo(() => calcStats(trades), [trades])
  const recentTrades = trades.slice(0, 20)
  const [now, setNow] = useState('')

  useEffect(() => {
    const fmt = () => {
      const d = new Date()
      setNow(
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) +
        ' · ' +
        d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      )
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
          <span className="brand-logo">Journal<em>yze</em></span>
          <span className="brand-tag">Live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="lv-topbar-time">{now}</span>
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
      <main className="lv-main">

        {/* Page header */}
        <div className="ph">
          <div>
            <div className="ph-label">Trading Journal</div>
            <h1 className="ph-title">Live <em>Statistics</em></h1>
            <p className="ph-sub">Snapshot publik · {stats.total} total trade tercatat</p>
          </div>
        </div>

        {/* ── STAT CARDS ─────────────────────────────────────────── */}
        <div className="lv-stats-grid lv-anim d1">
          <SCard label="Total Trade" value={String(stats.total)} />
          <SCard label="Total PnL" value={fmtPnl(stats.totalPnl)} cls={stats.totalPnl >= 0 ? 'green' : 'red'} />
          {config.showWinrate && (
            <SCard label="Win Rate" value={fmtNum(stats.winrate, 1) + '%'} cls={stats.winrate >= 50 ? 'green' : 'red'} />
          )}
          <SCard label="Risk Reward" value={'1 : ' + fmtNum(stats.rr, 2)} />
          <SCard label="Win" value={String(stats.wins)} cls="green" />
          <SCard label="Loss" value={String(stats.losses)} cls="red" />
        </div>

        {/* ── STREAK + BEST + WORST ──────────────────────────────── */}
        <div className="lv-meta-grid lv-anim d2">

          {/* Streak */}
          <div className="box lv-streak-box">
            <MiniLabel>Current Streak</MiniLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 22 }}>
                {stats.streakType === 'win' ? '🔥' : stats.streakType === 'loss' ? '❄️' : '—'}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700,
                color: stats.streakType === 'win' ? 'var(--green)' : stats.streakType === 'loss' ? 'var(--red)' : 'var(--text3)',
              }}>
                {stats.streak > 0 ? `${stats.streak}${stats.streakType === 'win' ? 'W' : 'L'}` : '—'}
              </span>
            </div>

            <div className="lv-divider" />

            <div className="lv-streak-sub-grid">
              <div>
                <MiniLabel>Win / Loss</MiniLabel>
                <div style={{ marginTop: 5, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{stats.wins}W</span>
                  <span style={{ color: 'var(--text4)', fontSize: 10 }}>/</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{stats.losses}L</span>
                </div>
              </div>
              <div>
                <MiniLabel>Avg Win / Avg Loss</MiniLabel>
                <div style={{ marginTop: 5, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>+{fmtIdr(stats.avgWin)}</span>
                  <span style={{ color: 'var(--text4)', fontSize: 10 }}>/</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>-{fmtIdr(stats.avgLoss)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Best trade */}
          {stats.bestTrade && (
            <div className="box lv-highlight-card lv-highlight-best">
              <MiniLabel cls="green">▲ Best Trade</MiniLabel>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--green)', marginTop: 8 }}>
                {fmtPnl(stats.bestTrade.pl_idr || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {stats.bestTrade.pair} · {stats.bestTrade.tanggal}
              </div>
            </div>
          )}

          {/* Worst trade */}
          {stats.worstTrade && (
            <div className="box lv-highlight-card lv-highlight-worst">
              <MiniLabel cls="red">▼ Worst Trade</MiniLabel>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--red)', marginTop: 8 }}>
                {fmtPnl(stats.worstTrade.pl_idr || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {stats.worstTrade.pair} · {stats.worstTrade.tanggal}
              </div>
            </div>
          )}
        </div>

        {/* ── EQUITY + PAIR ──────────────────────────────────────── */}
        <div className="lv-equity-grid lv-anim d3">

          {config.showEquity && stats.equity.length > 1 && (
            <div className="box" style={{ marginBottom: 0 }}>
              <div className="box-head">
                <span className="box-title">Equity Curve</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700,
                  color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {fmtPnl(stats.totalPnl)}
                </span>
              </div>
              <div style={{ padding: '8px 16px 14px' }}>
                <EquityChart equity={stats.equity} />
              </div>
            </div>
          )}

          {stats.pairs.length > 0 && (
            <div className="box" style={{ marginBottom: 0 }}>
              <div className="box-head">
                <span className="box-title">Pair Distribution</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                {stats.pairs.slice(0, 6).map(({ pair, count, pct }) => (
                  <div key={pair}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: 'var(--gold2)' }}>{pair}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--text3)' }}>{count} · {fmtNum(pct, 1)}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 99 }} />
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
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--text3)' }}>Read-only</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="dtable" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Pair</th>
                    <th>Tipe</th>
                    <th>Lot</th>
                    <th>PnL (IDR)</th>
                    <th>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map(t => {
                    const pnl = t.pl_idr || 0
                    return (
                      <tr key={t.id}>
                        <td style={{ color: 'var(--text2)', whiteSpace: 'nowrap' }}>{t.tanggal}</td>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--gold2)' }}>{t.pair}</td>
                        <td><span className={t.posisi === 'Buy' ? 'chip chip-buy' : 'chip chip-sell'}>{t.posisi}</span></td>
                        <td style={{ color: 'var(--text2)' }}>{t.lot}</td>
                        <td className={pnl >= 0 ? 'pos-val' : 'neg-val'} style={{ whiteSpace: 'nowrap' }}>{fmtPnl(pnl)}</td>
                        <td>
                          <span className={t.result === 'Profit' ? 'chip chip-profit' : t.result === 'Lose' ? 'chip chip-lose' : 'chip chip-gold'}>
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
        <footer className="lv-footer">
          <span className="brand-logo" style={{ fontSize: 16 }}>Journal<em>yze</em></span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)' }}>
            Public Live View · #{shareToken.slice(-6)}
          </span>
        </footer>

      </main>

      {/* ── STYLES ─────────────────────────────────────────────────── */}
      <style>{`
        .lv-root { min-height: 100vh; background: var(--bg); color: var(--text); }

        /* Main container */
        .lv-main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 80px;
        }

        /* Topbar time — hide on very small */
        .lv-topbar-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: var(--text3);
          letter-spacing: 1px;
        }
        @media (max-width: 480px) {
          .lv-topbar-time { display: none; }
        }

        /* ── Stat cards — 6 col → 3 col → 2 col ── */
        .lv-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 12px;
        }
        @media (max-width: 900px) {
          .lv-stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 480px) {
          .lv-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
        }

        /* ── Meta grid (streak + best + worst) ── */
        .lv-meta-grid {
          display: grid;
          grid-template-columns: 1fr 170px 170px;
          gap: 10px;
          margin-bottom: 14px;
        }
        @media (max-width: 768px) {
          .lv-meta-grid { grid-template-columns: 1fr 1fr; }
          .lv-streak-box { grid-column: 1 / -1; }
        }
        @media (max-width: 400px) {
          .lv-meta-grid { grid-template-columns: 1fr; }
        }

        /* Streak box internals */
        .lv-streak-box { padding: 14px 16px; margin-bottom: 0; }
        .lv-divider { height: 1px; background: var(--border); margin: 12px 0; }
        .lv-streak-sub-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 400px) {
          .lv-streak-sub-grid { grid-template-columns: 1fr; }
        }

        /* Best/worst highlight cards */
        .lv-highlight-card { padding: 14px 16px; margin-bottom: 0; }
        .lv-highlight-best { border-color: var(--green-bd) !important; background: var(--green-bg) !important; }
        .lv-highlight-worst { border-color: var(--red-bd) !important; background: var(--red-bg) !important; }

        /* ── Equity + pair grid ── */
        .lv-equity-grid {
          display: grid;
          grid-template-columns: 1fr 240px;
          gap: 14px;
          margin-bottom: 14px;
        }
        @media (max-width: 768px) {
          .lv-equity-grid { grid-template-columns: 1fr; }
        }

        /* ── Micro label ── */
        .lv-micro-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 7.5px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text3);
        }
        .lv-micro-label.green { color: var(--green); }
        .lv-micro-label.red   { color: var(--red); }

        /* ── Animations ── */
        .lv-anim {
          opacity: 0;
          transform: translateY(8px);
          animation: lv-fadeup .4s ease forwards;
        }
        @keyframes lv-fadeup { to { opacity: 1; transform: none; } }
        .lv-anim.d1 { animation-delay: .05s; }
        .lv-anim.d2 { animation-delay: .12s; }
        .lv-anim.d3 { animation-delay: .19s; }
        .lv-anim.d4 { animation-delay: .26s; }

        /* ── Footer ── */
        .lv-footer {
          margin-top: 48px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        /* ── Mobile padding adjust ── */
        @media (max-width: 480px) {
          .lv-main { padding: 16px 14px 80px; }
          .ph-title { font-size: 24px !important; }
        }

        /* ── dtable border-top instead of tbl-scroll ── */
        .lv-root .dtable thead tr { position: sticky; top: 0; z-index: 2; }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SCard({ label, value, cls }: { label: string; value: string; cls?: 'green' | 'red' }) {
  return (
    <div className="scard">
      <div className="scard-lbl">{label}</div>
      <div className={`scard-val${cls ? ' ' + cls : ''}`}>{value}</div>
    </div>
  )
}

function MiniLabel({ children, cls }: { children: React.ReactNode; cls?: 'green' | 'red' }) {
  return (
    <div className={`lv-micro-label${cls ? ' ' + cls : ''}`}>{children}</div>
  )
}