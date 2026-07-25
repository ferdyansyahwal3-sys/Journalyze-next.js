// components/admin/AnalyticsPanel.tsx
// Gabungan admin.html baris 270-358: stats cards, 4 chart, ranking, tabel user.
'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { fmtDate } from '@/lib/adminHelpers';
import type { Trade, DepositWithdrawal } from '@/lib/types';
import DailyTradesChart from './charts/DailyTradesChart';
import WinRateChart from './charts/WinRateChart';
import PairsChart from './charts/PairsChart';
import GrowthChart from './charts/GrowthChart';

export default function AnalyticsPanel({ active }: { active: boolean }) {
  const { loadAnalytics } = useAnalytics();
  const analyticsLoaded = useAdminStore((s) => s.analyticsLoaded);
  const allUserData = useAdminStore((s) => s.allUserData);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [dws, setDws] = useState<DepositWithdrawal[]>([]);
  const [uaSearch, setUaSearch] = useState('');
  const [growthDays, setGrowthDays] = useState(30);
  const [loading, setLoading] = useState(false);

  // admin.html: if(tab==='analytics' && !window._analyticsLoaded) loadAnalytics()
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

  const usersWithTrades = allUserData.filter((u) => u.trades > 0);
  const avgTrades = usersWithTrades.length ? Math.round(trades.length / usersWithTrades.length) : 0;
  const topRanking = usersWithTrades.slice(0, 7);
  const rankColors = ['gold', 'silver', 'bronze', '', '', '', ''];

  const filteredUsers = uaSearch
    ? allUserData.filter(
        (u) => u.email.toLowerCase().includes(uaSearch.toLowerCase()) || (u.name || '').toLowerCase().includes(uaSearch.toLowerCase())
      )
    : allUserData;

  return (
    <div className={`tab-pane ${active ? 'active' : ''}`} id="tab-analytics">
      <div className="main" style={{ display: 'block' }}>
        {/* STATS — admin.html baris 274-279 */}
        <div className="analytics-stats">
          <div className="a-card">
            <div className="a-card-lbl">Total User Aktif</div>
            <div className="a-card-val gold">{usersWithTrades.length}</div>
            <div className="a-card-sub">User dengan data trades</div>
          </div>
          <div className="a-card">
            <div className="a-card-lbl">Total Trades Dicatat</div>
            <div className="a-card-val green">{trades.length.toLocaleString('id-ID')}</div>
            <div className="a-card-sub">Semua user gabungan</div>
          </div>
          <div className="a-card">
            <div className="a-card-lbl">Avg Trades / User</div>
            <div className="a-card-val blue">{avgTrades}</div>
            <div className="a-card-sub">Rata-rata pemakaian</div>
          </div>
          <div className="a-card">
            <div className="a-card-lbl">Total Deposit Dicatat</div>
            <div className="a-card-val purple">{dws.length.toLocaleString('id-ID')}</div>
            <div className="a-card-sub">Dari semua user</div>
          </div>
        </div>

        {/* CHARTS ROW 1 */}
        <div className="analytics-grid">
          <div className="chart-box">
            <div className="chart-box-title">📈 Aktivitas Trades per Hari (30 hari terakhir)</div>
            <div className="chart-wrap">
              {!loading && <DailyTradesChart trades={trades} />}
            </div>
          </div>
          <div className="chart-box">
            <div className="chart-box-title">🏆 Top User Paling Aktif</div>
            <div className="ranking-list">
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  <span className="spinner"></span> Memuat ranking...
                </div>
              ) : !topRanking.length ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>Belum ada data trades</div>
              ) : (
                topRanking.map((u, i) => {
                  const wr = u.trades ? Math.round((u.wins / u.trades) * 100) : 0;
                  return (
                    <div className="rank-row" key={u.id}>
                      <div className={`rank-num ${rankColors[i]}`}>#{i + 1}</div>
                      <div className="rank-info">
                        <div className="rank-email" title={u.email}>{u.email}</div>
                        <div className="rank-meta">{u.trades} trades · Pair: {u.favPair}</div>
                      </div>
                      <div className={`rank-badge ${wr >= 50 ? '' : 'red'}`}>{wr}% WR</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CHARTS ROW 2 */}
        <div className="analytics-grid" style={{ marginBottom: 24 }}>
          <div className="chart-box">
            <div className="chart-box-title">🎯 Win Rate Top 10 User</div>
            <div className="chart-wrap">{!loading && <WinRateChart users={usersWithTrades} />}</div>
          </div>
          <div className="chart-box">
            <div className="chart-box-title">💱 Pair Paling Banyak Ditrade</div>
            <div className="chart-wrap">{!loading && <PairsChart trades={trades} />}</div>
          </div>
        </div>

        {/* GROWTH CHART */}
        <div className="chart-box" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            <div className="chart-box-title" style={{ marginBottom: 0 }}>📉 Pertumbuhan Trades per User (Kumulatif)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={growthDays}
                onChange={(e) => setGrowthDays(parseInt(e.target.value))}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text2)', fontFamily: "'JetBrains Mono',monospace", outline: 'none', cursor: 'pointer' }}
              >
                <option value={30}>30 Hari</option>
                <option value={90}>90 Hari</option>
                <option value={180}>6 Bulan</option>
                <option value={365}>1 Tahun</option>
              </select>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: 280 }}>
            {!loading && <GrowthChart users={allUserData} days={growthDays} />}
          </div>
        </div>

        {/* USER TABLE — admin.html baris 328-355 */}
        <div className="user-analytics-section">
          <div className="ua-head">
            <span className="ua-title">👤 Detail Performa Per User</span>
            <div className="ua-filter">
              <input
                type="text"
                className="ua-search"
                placeholder="Cari email user..."
                value={uaSearch}
                onChange={(e) => setUaSearch(e.target.value)}
              />
              <button className="refresh-btn" onClick={refresh}>⟳ Refresh</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Total Trade</th>
                  <th>Win Rate</th>
                  <th>Trade Terakhir</th>
                  <th>Deposit/WD</th>
                  <th>Pair Favorit</th>
                  <th>Tipe Akun</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                      <span className="spinner"></span> Memuat data analitik...
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
                    const status = u.is_blocked ? 'blocked' : u.is_activated ? 'active' : 'inactive';
                    const statusLabel = { blocked: '🚫 Diblokir', active: '🔑 Key Aktif', inactive: '⏳ Belum Input Key' }[status];
                    const lastT = u.lastTrade ? fmtDate(u.lastTrade + 'T00:00:00') : '—';
                    const wrPct = Math.min(u.wr, 100);
                    const wrColor = wrPct >= 60 ? '#22c55e' : wrPct >= 40 ? '#c9a84c' : '#e84040';
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontSize: 12, color: 'var(--text)' }}>{u.email}</div>
                          {u.name && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{u.name}</div>}
                        </td>
                        <td>
                          <span className={`status-dot ${status}`}></span>
                          <span style={{ fontSize: 11, color: 'var(--text2)' }}>{statusLabel}</span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--gold2)' }}>{u.trades}</span>
                        </td>
                        <td>
                          {u.trades ? (
                            <div className="wr-bar">
                              <div className="wr-fill" style={{ width: wrPct, maxWidth: 80, background: wrColor }}></div>
                              <span className="wr-text">{u.wr}%</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="date-text">{lastT}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--blue)' }}>{u.dwCount} transaksi</span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text2)' }}>{u.favPair}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, color: u.is_activated ? 'var(--green)' : 'var(--text3)' }}>
                            {u.is_activated ? '✓ Teraktivasi' : 'Belum aktivasi'}
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