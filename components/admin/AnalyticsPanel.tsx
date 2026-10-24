// components/admin/AnalyticsPanel.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { fmtDate } from '@/lib/adminHelpers';
import type { Trade, DepositWithdrawal } from '@/lib/types';
import DailyTradesChart from './charts/DailyTradesChart';
import WinRateChart from './charts/WinRateChart';
import PairsChart from './charts/PairsChart';
import GrowthChart from './charts/GrowthChart';

type DateRange = '7' | '30' | '90' | 'all';
const MEDAL = ['🥇', '🥈', '🥉'];

export default function AnalyticsPanel({ active }: { active: boolean }) {
  const { loadAnalytics } = useAnalytics();
  const analyticsLoaded = useAdminStore((s) => s.analyticsLoaded);
  const allUserData = useAdminStore((s) => s.allUserData);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [dws, setDws] = useState<DepositWithdrawal[]>([]);
  const [uaSearch, setUaSearch] = useState('');
  const [growthDays, setGrowthDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('30');

  useEffect(() => {
    if (active && !analyticsLoaded) {
      setLoading(true);
      loadAnalytics().then((res) => {
        if (res) {
          setTrades(res.trades as Trade[]);
          setDws(res.dws);
        }
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, analyticsLoaded]);

  const refresh = async () => {
    setLoading(true);
    const res = await loadAnalytics();
    if (res) {
      setTrades(res.trades as Trade[]);
      setDws(res.dws);
    }
    setLoading(false);
  };

  // Filter trades berdasarkan date range
  const filteredTrades = useMemo(() => {
    if (dateRange === 'all') return trades;
    const days = parseInt(dateRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return trades.filter((t) => new Date(t.tanggal) >= cutoff);
  }, [trades, dateRange]);

  const usersWithTrades = allUserData.filter((u) => u.trades > 0);
  const avgTrades = usersWithTrades.length
    ? Math.round(filteredTrades.length / usersWithTrades.length)
    : 0;

  // Hitung platform win rate
  const platformWins = usersWithTrades.reduce((acc, u) => acc + (u.wins || 0), 0);
  const platformTrades = usersWithTrades.reduce((acc, u) => acc + (u.trades || 0), 0);
  const platformWR = platformTrades ? Math.round((platformWins / platformTrades) * 100) : 0;

  // Avg WR per user
  const avgWR = usersWithTrades.length
    ? Math.round(usersWithTrades.reduce((acc, u) => acc + (u.wr || 0), 0) / usersWithTrades.length)
    : 0;

  // Top pair
  const pairCount: Record<string, number> = {};
  filteredTrades.forEach((t) => {
    if (t.pair) pairCount[t.pair] = (pairCount[t.pair] || 0) + 1;
  });
  const topPair = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const topRanking = usersWithTrades.slice(0, 7);

  const filteredUsers = uaSearch
    ? allUserData.filter(
        (u) =>
          u.email.toLowerCase().includes(uaSearch.toLowerCase()) ||
          (u.name || '').toLowerCase().includes(uaSearch.toLowerCase())
      )
    : allUserData;

  // WR color helper
  const wrColor = (wr: number) =>
    wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--gold)' : 'var(--red)';

  const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
    { label: '7 Hari', value: '7' },
    { label: '30 Hari', value: '30' },
    { label: '90 Hari', value: '90' },
    { label: 'All Time', value: 'all' },
  ];

  return (
    <div id="tab-analytics">
      <div className="main" style={{ display: 'block' }}>

        {/* ── HEADER ROW ── */}
        <div className="an-header">
          <div className="an-header-left">
            <div className="an-page-title">Analytics</div>
            <div className="an-page-sub">Platform overview · Journalyze</div>
          </div>
          <div className="an-header-right">
            <div className="an-range-group">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`an-range-btn${dateRange === opt.value ? ' active' : ''}`}
                  onClick={() => setDateRange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button className="refresh-btn" onClick={refresh} disabled={loading}>
              {loading ? <span className="spinner" /> : '⟳'} Refresh
            </button>
          </div>
        </div>

        {/* ── INSIGHT BAR ── */}
        <div className="an-insight-bar">
          <div className="an-insight-item">
            <span className="an-insight-dot" style={{ background: 'var(--gold)' }} />
            <span className="an-insight-text">
              Platform WR <strong style={{ color: 'var(--gold2)' }}>{platformWR}%</strong>
            </span>
          </div>
          <div className="an-insight-sep" />
          <div className="an-insight-item">
            <span className="an-insight-dot" style={{ background: 'var(--green)' }} />
            <span className="an-insight-text">
              Pair terpopuler <strong style={{ color: 'var(--text)' }}>{topPair}</strong>
            </span>
          </div>
          <div className="an-insight-sep" />
          <div className="an-insight-item">
            <span className="an-insight-dot" style={{ background: 'var(--blue)' }} />
            <span className="an-insight-text">
              Trader aktif <strong style={{ color: 'var(--text)' }}>{usersWithTrades.length} user</strong>
            </span>
          </div>
          <div className="an-insight-sep" />
          <div className="an-insight-item">
            <span className="an-insight-dot" style={{ background: 'var(--text3)' }} />
            <span className="an-insight-text">
              Range <strong style={{ color: 'var(--text2)' }}>
                {dateRange === 'all' ? 'Semua waktu' : `${dateRange} hari terakhir`}
              </strong>
            </span>
          </div>
        </div>

        {/* ── STAT CARDS (6 cards) ── */}
        <div className="an-stats-grid">
          <div className="an-card">
            <div className="an-card-icon">👥</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Total User Aktif</div>
              <div className="a-card-val gold">{usersWithTrades.length}</div>
              <div className="a-card-sub">User dengan data trades</div>
            </div>
          </div>
          <div className="an-card">
            <div className="an-card-icon">📊</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Total Trades</div>
              <div className="a-card-val green">{filteredTrades.length.toLocaleString('id-ID')}</div>
              <div className="a-card-sub">Dalam periode ini</div>
            </div>
          </div>
          <div className="an-card">
            <div className="an-card-icon">⚡</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Avg Trades / User</div>
              <div className="a-card-val blue">{avgTrades}</div>
              <div className="a-card-sub">Rata-rata pemakaian</div>
            </div>
          </div>
          <div className="an-card">
            <div className="an-card-icon">🎯</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Platform Win Rate</div>
              <div
                className="a-card-val"
                style={{ color: platformWR >= 50 ? 'var(--green)' : 'var(--red)' }}
              >
                {platformWR}%
              </div>
              <div className="a-card-sub">Gabungan semua user</div>
            </div>
          </div>
          <div className="an-card">
            <div className="an-card-icon">📈</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Avg WR per User</div>
              <div
                className="a-card-val"
                style={{ color: avgWR >= 50 ? 'var(--green)' : 'var(--gold2)' }}
              >
                {avgWR}%
              </div>
              <div className="a-card-sub">Rata-rata win rate</div>
            </div>
          </div>
          <div className="an-card">
            <div className="an-card-icon">💰</div>
            <div className="an-card-body">
              <div className="a-card-lbl">Total Deposit/WD</div>
              <div className="a-card-val" style={{ color: 'var(--text2)' }}>
                {dws.length.toLocaleString('id-ID')}
              </div>
              <div className="a-card-sub">Dari semua user</div>
            </div>
          </div>
        </div>

        {/* ── CHART AKTIVITAS HARIAN (full width) ── */}
        <div className="chart-box" style={{ marginBottom: 16 }}>
          <div className="an-chart-head">
            <div className="chart-box-title" style={{ marginBottom: 0 }}>
              📈 Aktivitas Trades per Hari
            </div>
            <div className="an-chart-badge">
              {dateRange === 'all' ? 'All Time' : `${dateRange} hari terakhir`}
            </div>
          </div>
          <div className="chart-wrap" style={{ height: 200 }}>
            {!loading && <DailyTradesChart trades={filteredTrades} />}
          </div>
        </div>

        {/* ── ROW: LEADERBOARD + PAIR CHART ── */}
        <div className="analytics-grid" style={{ marginBottom: 16 }}>

          {/* Leaderboard */}
          <div className="chart-box">
            <div className="an-chart-head">
              <div className="chart-box-title" style={{ marginBottom: 0 }}>🏆 Top User Paling Aktif</div>
              <div className="an-chart-badge">{topRanking.length} trader</div>
            </div>
            <div className="ranking-list" style={{ marginTop: 14 }}>
              {loading ? (
                <div className="an-loading-state">
                  <span className="spinner" /> Memuat ranking...
                </div>
              ) : !topRanking.length ? (
                <div className="an-loading-state">Belum ada data trades</div>
              ) : (
                topRanking.map((u, i) => {
                  const wr = u.trades ? Math.round((u.wins / u.trades) * 100) : 0;
                  const wrPct = Math.min(wr, 100);
                  return (
                    <div className="an-rank-row" key={u.id}>
                      <div className="an-rank-medal">
                        {i < 3 ? (
                          <span className="an-medal">{MEDAL[i]}</span>
                        ) : (
                          <span className="rank-num">#{i + 1}</span>
                        )}
                      </div>
                      <div className="rank-info">
                        <div className="rank-email" title={u.email}>{u.email}</div>
                        <div className="an-rank-meta-row">
                          <span className="rank-meta">{u.trades} trades · {u.favPair}</span>
                          <div className="an-wr-inline">
                            <div className="an-wr-bar">
                              <div
                                className="an-wr-fill"
                                style={{ width: `${wrPct}%`, background: wrColor(wr) }}
                              />
                            </div>
                            <span
                              className="an-wr-label"
                              style={{ color: wrColor(wr) }}
                            >
                              {wr}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pair Distribution */}
          <div className="chart-box">
            <div className="an-chart-head">
              <div className="chart-box-title" style={{ marginBottom: 0 }}>💱 Pair Distribution</div>
              <div className="an-chart-badge">Donut chart</div>
            </div>
            <div className="chart-wrap" style={{ marginTop: 14 }}>
              {!loading && <PairsChart trades={filteredTrades} />}
            </div>
          </div>
        </div>

        {/* ── WIN RATE CHART (full width) ── */}
        <div className="chart-box" style={{ marginBottom: 16 }}>
          <div className="an-chart-head">
            <div className="chart-box-title" style={{ marginBottom: 0 }}>📊 Win Rate Top 10 User</div>
            <div className="an-chart-badge">Bar chart</div>
          </div>
          <div className="chart-wrap" style={{ height: 220, marginTop: 14 }}>
            {!loading && <WinRateChart users={usersWithTrades} />}
          </div>
        </div>

        {/* ── GROWTH CHART ── */}
        <div className="chart-box" style={{ marginBottom: 16 }}>
          <div className="an-chart-head">
            <div className="chart-box-title" style={{ marginBottom: 0 }}>
              📉 Pertumbuhan Trades per User (Kumulatif)
            </div>
            <select
              value={growthDays}
              onChange={(e) => setGrowthDays(parseInt(e.target.value))}
              className="an-select"
            >
              <option value={30}>30 Hari</option>
              <option value={90}>90 Hari</option>
              <option value={180}>6 Bulan</option>
              <option value={365}>1 Tahun</option>
            </select>
          </div>
          <div className="chart-wrap" style={{ height: 260, marginTop: 14 }}>
            {!loading && <GrowthChart users={allUserData} days={growthDays} />}
          </div>
        </div>

        {/* ── USER TABLE ── */}
        <div className="user-analytics-section">
          <div className="ua-head">
            <span className="ua-title">👤 Detail Performa Per User</span>
            <div className="ua-filter">
              <input
                type="text"
                className="ua-search"
                placeholder="Cari email atau nama..."
                value={uaSearch}
                onChange={(e) => setUaSearch(e.target.value)}
              />
              <button className="refresh-btn" onClick={refresh} disabled={loading}>
                {loading ? <span className="spinner" /> : '⟳'} Refresh
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Total Trade</th>
                  <th>Win Rate</th>
                  <th>Trade Terakhir</th>
                  <th>Deposit/WD</th>
                  <th>Pair Favorit</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                      <span className="spinner" /> Memuat data analitik...
                    </td>
                  </tr>
                ) : !filteredUsers.length ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">Tidak ada data user</div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const statusKey = u.is_blocked ? 'blocked' : u.is_activated ? 'active' : 'inactive';
                    const statusLabel = {
                      blocked: 'Diblokir',
                      active: 'Aktif',
                      inactive: 'Belum Aktivasi',
                    }[statusKey];
                    const lastT = u.lastTrade ? fmtDate(u.lastTrade + 'T00:00:00') : '—';
                    const wrPct = Math.min(u.wr, 100);
                    const plan = (u.plan || 'free') as string;
                    return (
                      <tr key={u.id}>
                        <td data-label="User">
                          <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace" }}>
                            {u.email}
                          </div>
                          {u.name && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{u.name}</div>
                          )}
                        </td>
                        <td data-label="Status">
                          <div className="an-status-pill" data-status={statusKey}>
                            <span
                              className="status-dot"
                              style={{
                                background:
                                  statusKey === 'active'
                                    ? 'var(--green)'
                                    : statusKey === 'blocked'
                                    ? '#c084fc'
                                    : 'var(--text3)',
                              }}
                            />
                            {statusLabel}
                          </div>
                        </td>
                        <td data-label="Plan">
                          <span className={`badge plan-${plan}`}>{plan.toUpperCase()}</span>
                        </td>
                        <td data-label="Total Trade">
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 14,
                              fontWeight: 700,
                              color: u.trades > 0 ? 'var(--gold2)' : 'var(--text3)',
                            }}
                          >
                            {u.trades}
                          </span>
                        </td>
                        <td data-label="Win Rate">
                          {u.trades ? (
                            <div className="an-wr-cell">
                              <div className="an-wr-bar" style={{ width: 72 }}>
                                <div
                                  className="an-wr-fill"
                                  style={{ width: `${wrPct}%`, background: wrColor(u.wr) }}
                                />
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: wrColor(u.wr) }}>
                                {u.wr}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text4)' }}>—</span>
                          )}
                        </td>
                        <td data-label="Trade Terakhir">
                          <span className="date-text">{lastT}</span>
                        </td>
                        <td data-label="Deposit/WD">
                          <span style={{ fontSize: 12, color: 'var(--blue)' }}>{u.dwCount} transaksi</span>
                        </td>
                        <td data-label="Pair Favorit">
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 11,
                              color: 'var(--text2)',
                              background: 'var(--bg4)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                            }}
                          >
                            {u.favPair || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
