'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import './dashboard.css';

interface AffiliateData {
  id: string; name: string; email: string;
  affiliate_code: string; affiliate_slug: string;
  bank_name: string | null; bank_account: string | null; bank_holder: string | null;
}
interface Referral {
  id: string; created_at: string; buyer_name: string | null; buyer_email: string;
  plan_type: string; plan_price: number; commission: number;
  status: 'pending' | 'paid'; paid_at: string | null; payout_batch: string | null;
}
interface FunnelStats {
  landing_views: number; cta_clicks: number; order_views: number;
  plan_selects: number; checkout_starts: number;
}
interface DashboardData { affiliate: AffiliateData; referrals: Referral[]; funnel: FunnelStats; }

const BASE_URL = 'https://journalyze.my.id';
function fmtRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtPct(num: number, den: number) { if (den === 0) return '0%'; return (Math.round((num / den) * 1000) / 10).toFixed(1) + '%'; }

function DashboardInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [tab, setTab]         = useState<'overview' | 'referrals'>('overview');

  useEffect(() => {
    if (!token) { setError('Token tidak valid.'); setLoading(false); return; }
    fetch(`/api/affiliate/dashboard?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { error?: string } & DashboardData) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Gagal memuat data. Coba lagi.'))
      .finally(() => setLoading(false));
  }, [token]);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(`${BASE_URL}/?ref=${data.affiliate.affiliate_slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="aff-root">
      <div className="aff-loading"><span className="aff-spinner" /><span>Memuat dashboard...</span></div>
    </div>
  );

  if (error || !data) return (
    <div className="aff-root">
      <div className="aff-error">
        <div className="aff-error-icon">⚠️</div>
        <div className="aff-error-title">Akses Ditolak</div>
        <div className="aff-error-sub">{error || 'Token tidak valid.'}</div>
        <a href="/" className="aff-btn-back">← Kembali ke Beranda</a>
      </div>
    </div>
  );

  const { affiliate, referrals, funnel } = data;
  const totalEarned  = referrals.reduce((s, r) => s + r.commission, 0);
  const totalPending = referrals.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0);
  const totalPaid    = referrals.filter(r => r.status === 'paid').reduce((s, r) => s + r.commission, 0);
  const convRate     = fmtPct(referrals.length, funnel.landing_views);
  const affiliateLink = `${BASE_URL}/?ref=${affiliate.affiliate_slug}`;

  return (
    <div className="aff-root">
      <nav className="aff-nav">
        <a href="/" className="aff-nav-logo">Journal<em>yze</em><span className="aff-nav-badge">Affiliate</span></a>
        <div className="aff-nav-user"><span className="aff-nav-dot" /><span>{affiliate.name}</span></div>
      </nav>
      <main className="aff-main">
        <div className="aff-header">
          <div className="aff-header-label">Dashboard Affiliate</div>
          <h1 className="aff-header-title">Halo, <em>{affiliate.name.split(' ')[0]}</em> 👋</h1>
          <p className="aff-header-sub">Pantau performa link affiliate dan komisi kamu.</p>
        </div>

        <div className="aff-link-box">
          <div className="aff-link-label">Link Affiliate Kamu</div>
          <div className="aff-link-row">
            <div className="aff-link-url">{affiliateLink}</div>
            <button className="aff-link-copy" onClick={copyLink}>{copied ? '✓ Disalin!' : '📋 Salin Link'}</button>
          </div>
          <div className="aff-link-hint">Bagikan link ini ke calon pembeli. Komisi otomatis tercatat saat mereka membeli.</div>
        </div>

        <div className="aff-stats">
          {[
            { lbl: 'Total Komisi',  val: fmtRp(totalEarned),  sub: `dari ${referrals.length} referral`, gold: true },
            { lbl: 'Menunggu Cair', val: fmtRp(totalPending), sub: 'belum dibayarkan',                  gold: totalPending > 0 },
            { lbl: 'Sudah Dibayar', val: fmtRp(totalPaid),    sub: 'sudah cair ke rekening',            gold: false },
            { lbl: 'Conv. Rate',    val: convRate,             sub: 'landing → pembayaran',              gold: false },
          ].map(s => (
            <div key={s.lbl} className="aff-stat-card">
              <div className="aff-stat-lbl">{s.lbl}</div>
              <div className={`aff-stat-val${s.gold ? ' gold' : ''}`}>{s.val}</div>
              <div className="aff-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="aff-tabs">
          {([{ id: 'overview', label: '📊 Performa' }, { id: 'referrals', label: '📋 Riwayat Komisi' }] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`aff-tab${tab === t.id ? ' active' : ''}`}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="aff-section">
            <div className="aff-card">
              <div className="aff-card-title">Funnel Performa Link</div>
              <div className="aff-funnel">
                {[
                  { lbl: 'Buka Landing',   val: funnel.landing_views,   color: '#6366f1' },
                  { lbl: 'Klik Pesan',     val: funnel.cta_clicks,      color: '#C9A84C' },
                  { lbl: 'Halaman Order',  val: funnel.order_views,     color: '#f97316' },
                  { lbl: 'Mulai Checkout', val: funnel.checkout_starts, color: '#ec4899' },
                  { lbl: 'Bayar ✓',        val: referrals.length,       color: '#22c55e' },
                ].map((s, i, arr) => (
                  <div key={s.lbl} className="aff-funnel-step">
                    <div className="aff-funnel-box" style={{ borderColor: s.color + '55', background: s.color + '12' }}>
                      <div className="aff-funnel-num" style={{ color: s.color }}>{s.val.toLocaleString('id-ID')}</div>
                      <div className="aff-funnel-lbl">{s.lbl}</div>
                      {i > 0 && <div className="aff-funnel-pct" style={{ color: s.color }}>{fmtPct(s.val, arr[i-1].val)}</div>}
                    </div>
                    {i < arr.length - 1 && <div className="aff-funnel-arrow">↓</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="aff-card">
              <div className="aff-card-title">Paket yang Dibeli</div>
              {referrals.length === 0 ? <div className="aff-empty">Belum ada referral yang berhasil.</div> : (
                <div className="aff-breakdown">
                  {['basic', 'pro', 'elite'].map(p => {
                    const count = referrals.filter(r => r.plan_type === p).length;
                    const pct   = referrals.length > 0 ? Math.round(count / referrals.length * 100) : 0;
                    const color = p === 'elite' ? '#f97316' : p === 'pro' ? '#C9A84C' : '#6366f1';
                    return (
                      <div key={p} className="aff-breakdown-row">
                        <div className="aff-breakdown-head">
                          <span className={`aff-badge aff-badge-${p}`}>{p.toUpperCase()}</span>
                          <span className="aff-breakdown-count">{count}× · {fmtRp(referrals.filter(r => r.plan_type === p).reduce((s, r) => s + r.commission, 0))} komisi</span>
                        </div>
                        <div className="aff-bar-bg"><div className="aff-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="aff-card">
              <div className="aff-card-title">Info Rekening Payout</div>
              <div className="aff-bank-grid">
                {[['Bank', affiliate.bank_name], ['No. Rekening', affiliate.bank_account], ['Atas Nama', affiliate.bank_holder], ['Email', affiliate.email]].map(([lbl, val]) => (
                  <div key={lbl}><div className="aff-bank-lbl">{lbl}</div><div className="aff-bank-val">{val || '—'}</div></div>
                ))}
              </div>
              <div className="aff-bank-note">Payout diproses setiap minggu oleh tim Journalyze.</div>
            </div>
          </div>
        )}

        {tab === 'referrals' && (
          <div className="aff-section">
            <div className="aff-card">
              <div className="aff-card-title">Riwayat Komisi</div>
              {referrals.length === 0 ? <div className="aff-empty">Belum ada komisi. Bagikan link affiliate kamu untuk mulai.</div> : (
                <>
                  <div className="aff-table-wrap">
                    <table className="aff-table">
                      <thead><tr><th>Tanggal</th><th>Pembeli</th><th>Paket</th><th>Komisi</th><th>Status</th></tr></thead>
                      <tbody>
                        {referrals.map((r, i) => (
                          <tr key={r.id} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td className="aff-td-date">{fmtDate(r.created_at)}</td>
                            <td><div className="aff-td-name">{r.buyer_name || '—'}</div><div className="aff-td-email">{r.buyer_email}</div></td>
                            <td><span className={`aff-badge aff-badge-${r.plan_type}`}>{r.plan_type.toUpperCase()}</span></td>
                            <td className="aff-td-commission">{fmtRp(r.commission)}</td>
                            <td>
                              <span className={`aff-status ${r.status === 'paid' ? 'paid' : 'pending'}`}>
                                <span className="aff-status-dot" />{r.status === 'paid' ? 'Cair' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="aff-summary">
                    <div className="aff-summary-item"><span className="aff-summary-lbl">Total pending</span><span className="aff-summary-val gold">{fmtRp(totalPending)}</span></div>
                    <div className="aff-summary-item"><span className="aff-summary-lbl">Total sudah cair</span><span className="aff-summary-val">{fmtRp(totalPaid)}</span></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className="aff-footer">
        <span>© 2025 Journalyze. All rights reserved.</span>
        <a href={`https://wa.me/6281311973602?text=${encodeURIComponent('Halo admin Journalyze, saya ingin tanya soal komisi affiliate saya 🙏')}`} target="_blank" rel="noopener noreferrer" className="aff-footer-wa">💬 Hubungi Admin</a>
      </footer>
    </div>
  );
}

export default function AffiliateDashboard() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}><div style={{ color: '#C9A84C', fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>Memuat...</div></div>}>
      <DashboardInner />
    </Suspense>
  );
}
