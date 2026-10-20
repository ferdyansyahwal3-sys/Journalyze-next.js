'use client';

// components/admin/AffiliatePanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { fmtDate } from '@/lib/adminHelpers';

// ── Types ──────────────────────────────────────────────────────────────────
interface Affiliate {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  affiliate_code: string;
  affiliate_slug: string;
  is_active: boolean;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  notes: string | null;
  dashboard_token: string | null;
}

interface Referral {
  id: string;
  created_at: string;
  affiliate_id: string;
  order_id: string;
  buyer_email: string;
  buyer_name: string | null;
  plan_type: string;
  plan_price: number;
  commission: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  payout_batch: string | null;
}

interface LinkEvent {
  id: string;
  created_at: string;
  affiliate_code: string;
  event_type: string;
  page: string;
  referrer: string | null;
  session_id: string | null;
  plan_type: string | null;
}

interface AffiliateWithStats extends Affiliate {
  totalReferrals: number;
  totalPending: number;
  totalRevenue: number;
  // funnel
  landingViews: number;
  orderViews: number;
  checkoutStarts: number;
  conversions: number;
}

const BASE_URL = 'https://journalyze.my.id';

function fmtRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function fmtPct(num: number, den: number) {
  if (den === 0) return '0%';
  return (Math.round((num / den) * 1000) / 10).toFixed(1) + '%';
}

function getPayoutBatch() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 12);
}
function codeify(name: string) {
  return (name.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 8) + '10').slice(0, 12);
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', affiliate_code: '', affiliate_slug: '',
  is_active: true, bank_name: '', bank_account: '', bank_holder: '', notes: '',
};

// ── Mini bar chart ──────────────────────────────────────────────────────────
function BarChart({ data, color = '#C9A84C' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 480; const H = 100;
  const barW = Math.max(18, Math.floor((W - 40) / data.length) - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', maxHeight: 150 }}>
      {data.map((d, i) => {
        const slotW = (W - 40) / data.length;
        const x = 20 + i * slotW + (slotW - barW) / 2;
        const barH = Math.max(2, Math.round((d.value / max) * H));
        const y = H - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={d.value > 0 ? color : 'rgba(255,255,255,0.05)'} rx={4} opacity={0.85} />
            <text x={x + barW / 2} y={H + 18} textAnchor="middle"
              fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="JetBrains Mono,monospace">
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill={color} fontSize={9} fontFamily="JetBrains Mono,monospace" fontWeight="700">
                {d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Funnel Step ─────────────────────────────────────────────────────────────
function FunnelStep({
  label, count, pct, color, isLast,
}: {
  label: string; count: number; pct?: string; color: string; isLast?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{
        width: '100%', background: `${color}18`,
        border: `1px solid ${color}55`, borderRadius: 10,
        padding: '14px 8px', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 32, fontWeight: 700, color,
        }}>
          {count.toLocaleString('id-ID')}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4,
        }}>
          {label}
        </div>
        {pct && (
          <div style={{
            marginTop: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            color, fontWeight: 700,
          }}>
            {pct} conv.
          </div>
        )}
      </div>
      {!isLast && (
        <div style={{ fontSize: 16, color: 'var(--text3)', margin: '6px 0' }}>↓</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function AffiliatePanel({ active }: { active: boolean }) {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([]);
  const [referrals,  setReferrals]  = useState<Referral[]>([]);
  const [events,     setEvents]     = useState<LinkEvent[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);

  const [section, setSection] = useState<'list' | 'funnel' | 'referrals' | 'analytics' | 'payout'>('list');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Affiliate | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState('');

  const [filterAffiliate,   setFilterAffiliate]   = useState('all');
  const [filterStatus,      setFilterStatus]      = useState<'all' | 'pending' | 'paid'>('all');
  const [analyticsAffiliate, setAnalyticsAffiliate] = useState('all');
  const [funnelAffiliate,   setFunnelAffiliate]   = useState('all');
  const [payoutAffiliate,   setPayoutAffiliate]   = useState('all');
  const [payoutConfirming,  setPayoutConfirming]  = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  // ── Load ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: affData }, { data: refData }, { data: evData }] = await Promise.all([
        _sbAdmin.from('affiliates').select('*').order('created_at', { ascending: false }),
        _sbAdmin.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
        _sbAdmin.from('affiliate_link_events').select('*').order('created_at', { ascending: false }),
      ]);

      const refs   = (refData ?? []) as Referral[];
      const evts   = (evData  ?? []) as LinkEvent[];
      setReferrals(refs);
      setEvents(evts);

      const withStats: AffiliateWithStats[] = (affData ?? []).map((a) => {
        const mine     = refs.filter(r => r.affiliate_id === a.id);
        const myEvents = evts.filter(e => e.affiliate_code === a.affiliate_code.toLowerCase());

        return {
          ...(a as Affiliate),
          totalReferrals:  mine.length,
          totalPending:    mine.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0),
          totalRevenue:    mine.reduce((s, r) => s + r.plan_price, 0),
          landingViews:    myEvents.filter(e => e.event_type === 'landing_view' || (e.event_type === 'view' && e.page === 'landing')).length,
          orderViews:      myEvents.filter(e => e.event_type === 'order_view'   || (e.event_type === 'view' && e.page === 'order')).length,
          checkoutStarts:  myEvents.filter(e => e.event_type === 'checkout_start').length,
          conversions:     mine.length,
        };
      });

      setAffiliates(withStats);
      setLoaded(true);
    } catch (e) {
      console.error('[AffiliatePanel]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (active && !loaded) loadData(); }, [active, loaded, loadData]);

  // ── Funnel data ────────────────────────────────────────────────────────
  const funnelAffilObj = funnelAffiliate === 'all'
    ? null
    : affiliates.find(a => a.id === funnelAffiliate);

  const funnelEvents = funnelAffiliate === 'all'
    ? events
    : events.filter(e => e.affiliate_code === funnelAffilObj?.affiliate_code.toLowerCase());

  const funnelRefs = funnelAffiliate === 'all'
    ? referrals
    : referrals.filter(r => r.affiliate_id === funnelAffiliate);

  const fLandingViews   = funnelEvents.filter(e => e.event_type === 'landing_view'  || (e.event_type === 'view'  && e.page === 'landing')).length;
  const fOrderViews     = funnelEvents.filter(e => e.event_type === 'order_view'    || (e.event_type === 'view'  && e.page === 'order')).length;
  const fPlanSelects    = funnelEvents.filter(e => e.event_type === 'plan_select').length;
  const fCheckoutStarts = funnelEvents.filter(e => e.event_type === 'checkout_start').length;
  const fConversions    = funnelRefs.length;

  // Plan breakdown in funnel
  const fPlanBreakdown = ['basic', 'pro', 'elite'].map(p => ({
    plan: p,
    selects: funnelEvents.filter(e => e.event_type === 'plan_select' && e.plan_type === p).length,
    conversions: funnelRefs.filter(r => r.plan_type === p).length,
  }));

  // ── Analytics ─────────────────────────────────────────────────────────
  const analyticsRefs = analyticsAffiliate === 'all'
    ? referrals
    : referrals.filter(r => r.affiliate_id === analyticsAffiliate);

  const totalRevenue    = analyticsRefs.reduce((s, r) => s + r.plan_price, 0);
  const totalCommission = analyticsRefs.reduce((s, r) => s + r.commission, 0);
  const totalPendingAll = analyticsRefs.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0);
  const totalPaid       = analyticsRefs.filter(r => r.status === 'paid').reduce((s, r) => s + r.commission, 0);

  const monthlyData = (() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        label: d.toLocaleString('id-ID', { month: 'short' }),
        value: analyticsRefs.filter(r => r.created_at.startsWith(key)).length,
      });
    }
    return months;
  })();

  const revenueData = (() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = analyticsRefs.filter(r => r.created_at.startsWith(key)).reduce((s, r) => s + r.plan_price, 0);
      months.push({ label: d.toLocaleString('id-ID', { month: 'short' }), value: Math.round(total / 1000) });
    }
    return months;
  })();

  const planBreakdown = ['basic', 'pro', 'elite'].map(p => ({
    plan: p,
    count: analyticsRefs.filter(r => r.plan_type === p).length,
    revenue: analyticsRefs.filter(r => r.plan_type === p).reduce((s, r) => s + r.plan_price, 0),
  }));

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null); setForm({ ...EMPTY_FORM }); setFormError(''); setModalOpen(true);
  }
  function openEdit(a: Affiliate) {
    setEditTarget(a);
    setForm({
      name: a.name, email: a.email, phone: a.phone ?? '',
      affiliate_code: a.affiliate_code, affiliate_slug: a.affiliate_slug,
      is_active: a.is_active, bank_name: a.bank_name ?? '',
      bank_account: a.bank_account ?? '', bank_holder: a.bank_holder ?? '', notes: a.notes ?? '',
    });
    setFormError(''); setModalOpen(true);
  }
  function handleNameChange(val: string) {
    setForm(f => ({
      ...f, name: val,
      affiliate_code: editTarget ? f.affiliate_code : codeify(val),
      affiliate_slug: editTarget ? f.affiliate_slug : slugify(val),
    }));
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim())           return setFormError('Nama wajib diisi.');
    if (!form.email.trim())          return setFormError('Email wajib diisi.');
    if (!form.affiliate_code.trim()) return setFormError('Kode affiliate wajib diisi.');
    setSaving(true);
    try {
      const payload = {
        name:           form.name.trim(),
        email:          form.email.trim().toLowerCase(),
        phone:          form.phone?.trim() || null,
        affiliate_code: form.affiliate_code.trim().toUpperCase(),
        affiliate_slug: form.affiliate_code.trim().toLowerCase(),
        is_active:      form.is_active,
        bank_name:      form.bank_name?.trim()    || null,
        bank_account:   form.bank_account?.trim() || null,
        bank_holder:    form.bank_holder?.trim()  || null,
        notes:          form.notes?.trim()        || null,
      };
      if (editTarget) {
        const { error } = await _sbAdmin.from('affiliates').update(payload).eq('id', editTarget.id);
        if (error) throw error;
        showToast('Affiliate berhasil diupdate.');
      } else {
        const { error } = await _sbAdmin.from('affiliates').insert(payload);
        if (error) throw error;
        showToast('Affiliate berhasil ditambahkan.');
      }
      setModalOpen(false); setLoaded(false); await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFormError(msg.includes('duplicate') || msg.includes('unique')
        ? 'Kode atau email sudah digunakan.' : msg);
    } finally { setSaving(false); }
  }

  async function toggleActive(a: Affiliate) {
    const { error } = await _sbAdmin.from('affiliates').update({ is_active: !a.is_active }).eq('id', a.id);
    if (error) { showToast('Gagal update status.', false); return; }
    showToast(`${a.name} ${!a.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`);
    setLoaded(false); await loadData();
  }

  // ── Payout ────────────────────────────────────────────────────────────
  const pendingForPayout = referrals.filter(r => {
    if (r.status !== 'pending') return false;
    if (payoutAffiliate !== 'all' && r.affiliate_id !== payoutAffiliate) return false;
    return true;
  });
  const payoutTotal = pendingForPayout.reduce((s, r) => s + r.commission, 0);

  async function handleMarkPaid() {
    setPayoutConfirming(false);
    const batch = getPayoutBatch();
    const ids = pendingForPayout.map(r => r.id);
    const { error } = await _sbAdmin.from('affiliate_referrals')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payout_batch: batch })
      .in('id', ids);
    if (error) { showToast('Gagal update payout: ' + error.message, false); return; }
    showToast(`✅ ${ids.length} referral ditandai PAID (batch ${batch}).`);
    setLoaded(false); await loadData();
  }

  const filteredReferrals = referrals.filter(r => {
    if (filterAffiliate !== 'all' && r.affiliate_id !== filterAffiliate) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const iStyle: React.CSSProperties = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 13px', fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
    transition: 'all .2s',
  };

  const TH = ({ children }: { children: React.ReactNode }) => (
    <th style={{
      padding: '10px 14px', textAlign: 'left',
      background: 'rgba(201,168,76,0.05)', fontFamily: "'JetBrains Mono', monospace",
      fontSize: 7.5, letterSpacing: 1.8, textTransform: 'uppercase' as const,
      color: 'var(--gold)', borderBottom: '1px solid var(--gold-bd)', whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </th>
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="main" style={{ paddingTop: 24 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          background: 'var(--bg2)', border: `1px solid ${toast.ok ? 'var(--green-bd)' : 'var(--red-bd)'}`,
          color: toast.ok ? 'var(--green)' : 'var(--red)', borderRadius: 12, padding: '12px 20px',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, boxShadow: 'var(--shadow)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="ph" style={{ marginBottom: 20 }}>
        <div>
          <div className="ph-label">Admin Panel</div>
          <h2 className="ph-title">Sistem <em>Affiliate</em></h2>
          <p className="ph-sub">Kelola partner, track funnel, dan proses payout komisi.</p>
        </div>
        <button className="refresh-btn" onClick={loadData} disabled={loading}>
          {loading ? <><span className="spinner" />Memuat...</> : '↻ Refresh'}
        </button>
      </div>

      {/* Sub-nav tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)',
        border: '1px solid var(--border)', borderRadius: 10, padding: 4,
        width: 'fit-content', flexWrap: 'wrap',
      }}>
        {([
          { id: 'list',      label: '👥 Affiliate' },
          { id: 'funnel',    label: '🔻 Funnel' },
          { id: 'referrals', label: '📋 Referral Log' },
          { id: 'analytics', label: '📊 Analitik' },
          { id: 'payout',    label: '💸 Payout' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1,
              textTransform: 'uppercase', transition: 'all .2s',
              background: section === t.id ? 'var(--gold-bg)' : 'transparent',
              color: section === t.id ? 'var(--gold2)' : 'var(--text3)',
              borderBottom: section === t.id ? '1px solid var(--gold-bd2)' : '1px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ LIST ═══ */}
      {section === 'list' && (
        <div className="section">
          <div className="section-head">
            <span className="section-title">Daftar Affiliate Partner</span>
            <button className="gen-btn" onClick={openAdd}>+ Tambah Affiliate</button>
          </div>
          {loading && !affiliates.length ? (
            <div className="empty-state"><span className="spinner" />Memuat data...</div>
          ) : affiliates.length === 0 ? (
            <div className="empty-state">Belum ada affiliate. Klik &quot;+ Tambah Affiliate&quot; untuk mulai.</div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <TH>Nama & Email</TH>
                    <TH>Kode / Link</TH>
                    <TH>Status</TH>
                    <TH>Landing</TH>
                    <TH>Order Page</TH>
                    <TH>Checkout</TH>
                    <TH>Konversi</TH>
                    <TH>Conv. Rate</TH>
                    <TH>Komisi Pending</TH>
                    <TH>Aksi</TH>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 1 ? 'var(--row-alt)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{a.name}</div>
                        <div className="email-text">{a.email}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
                        <span className="key-mono" style={{ fontSize: 11, letterSpacing: 2 }}>{a.affiliate_code}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <span className="date-text" style={{ fontSize: 10 }}>
                            /?ref={a.affiliate_code.toLowerCase()}
                          </span>
                          <button onClick={() => {
                            navigator.clipboard.writeText(`${BASE_URL}/?ref=${a.affiliate_code.toLowerCase()}`);
                            showToast('Link disalin!');
                          }} className="act-btn act-copy" style={{ padding: '2px 6px', fontSize: 10 }}>
                            📋
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
                        <span className={`badge ${a.is_active ? 'used' : 'unused'}`}>
                          <span className="dot" />{a.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      {/* Funnel mini stats */}
                      {[
                        { val: a.landingViews,   color: '#6366f1' },
                        { val: a.orderViews,     color: '#C9A84C' },
                        { val: a.checkoutStarts, color: '#f97316' },
                        { val: a.conversions,    color: '#22c55e' },
                      ].map((s, si) => (
                        <td key={si} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                          <span style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: 22, color: s.val > 0 ? s.color : 'var(--text3)', fontWeight: 700,
                          }}>
                            {s.val}
                          </span>
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          color: a.conversions > 0 ? '#22c55e' : 'var(--text3)',
                        }}>
                          {fmtPct(a.conversions, a.landingViews)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700,
                          color: a.totalPending > 0 ? 'var(--gold2)' : 'var(--text3)',
                        }}>
                          {a.totalPending > 0 ? fmtRp(a.totalPending) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
                        {a.dashboard_token ? (
                          <button onClick={() => {
                            navigator.clipboard.writeText(`${BASE_URL}/affiliate/dashboard?token=${a.dashboard_token}`);
                            showToast('Link dashboard disalin!');
                          }} className="act-btn act-url" style={{ fontSize: 10 }}>
                            📊 Salin Link
                          </button>
                        ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
                        <div className="action-btns">
                          <button className="act-btn act-copy" onClick={() => openEdit(a)}>Edit</button>
                          <button
                            className={`act-btn ${a.is_active ? 'act-revoke' : 'act-restore'}`}
                            onClick={() => toggleActive(a)}>
                            {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ FUNNEL ═══ */}
      {section === 'funnel' && (
        <>
          {/* Filter */}
          <div className="section" style={{ marginBottom: 14 }}>
            <div className="section-head">
              <span className="section-title">Filter Funnel</span>
              <select
                value={funnelAffiliate}
                onChange={e => setFunnelAffiliate(e.target.value)}
                className="filter-select">
                <option value="all">Semua Affiliate</option>
                {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Funnel visual */}
          <div className="section" style={{ marginBottom: 14 }}>
            <div className="section-head">
              <span className="section-title">
                Funnel Konversi {funnelAffilObj ? `— ${funnelAffilObj.name}` : '(Semua)'}
              </span>
            </div>
            <div style={{ padding: '20px 20px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                <FunnelStep
                  label="Landing View"
                  count={fLandingViews}
                  color="#6366f1"
                />
                <FunnelStep
                  label="Order Page"
                  count={fOrderViews}
                  pct={fmtPct(fOrderViews, fLandingViews)}
                  color="#C9A84C"
                />
                <FunnelStep
                  label="Pilih Paket"
                  count={fPlanSelects}
                  pct={fmtPct(fPlanSelects, fOrderViews)}
                  color="#f97316"
                />
                <FunnelStep
                  label="Checkout"
                  count={fCheckoutStarts}
                  pct={fmtPct(fCheckoutStarts, fPlanSelects)}
                  color="#ec4899"
                />
                <FunnelStep
                  label="Bayar ✓"
                  count={fConversions}
                  pct={fmtPct(fConversions, fCheckoutStarts)}
                  color="#22c55e"
                  isLast
                />
              </div>

              {/* Overall conversion rate */}
              <div style={{
                marginTop: 20, padding: '14px 16px',
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: 1.5,
                }}>
                  Overall Conversion Rate (Landing → Bayar)
                </span>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 28, fontWeight: 700,
                  color: fConversions > 0 ? '#22c55e' : 'var(--text3)',
                }}>
                  {fmtPct(fConversions, fLandingViews)}
                </span>
              </div>
            </div>
          </div>

          {/* Plan breakdown in funnel */}
          <div className="section">
            <div className="section-head">
              <span className="section-title">Paket yang Dipilih vs Dibeli</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {fPlanBreakdown.map(p => {
                const barColor = p.plan === 'elite' ? '#f97316' : p.plan === 'pro' ? '#C9A84C' : '#6366f1';
                const maxVal = Math.max(...fPlanBreakdown.map(x => x.selects), 1);
                return (
                  <div key={p.plan}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className={`badge ${p.plan === 'elite' ? 'plan-elite' : p.plan === 'pro' ? 'plan-pro' : 'plan-basic'}`}>
                        {p.plan.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text2)' }}>
                        {p.selects} dipilih · {p.conversions} dibeli
                        {p.selects > 0 && (
                          <span style={{ color: '#22c55e', marginLeft: 6 }}>
                            ({fmtPct(p.conversions, p.selects)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, background: barColor,
                        width: `${Math.round((p.selects / maxVal) * 100)}%`,
                        transition: 'width .8s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-affiliate funnel table */}
          {funnelAffiliate === 'all' && affiliates.length > 0 && (
            <div className="section" style={{ marginTop: 14 }}>
              <div className="section-head">
                <span className="section-title">Perbandingan Funnel per Affiliate</span>
              </div>
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      <TH>Affiliate</TH>
                      <TH>Landing View</TH>
                      <TH>Order View</TH>
                      <TH>Checkout</TH>
                      <TH>Konversi</TH>
                      <TH>Conv. Rate</TH>
                      <TH>Revenue</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {[...affiliates]
                      .sort((a, b) => b.conversions - a.conversions)
                      .map((a, i) => (
                        <tr key={a.id} style={{ background: i % 2 === 1 ? 'var(--row-alt)' : 'transparent' }}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontWeight: 600, color: 'var(--gold2)', fontSize: 13 }}>
                            {a.name}
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>{a.affiliate_code}</div>
                          </td>
                          {[a.landingViews, a.orderViews, a.checkoutStarts, a.conversions].map((v, vi) => {
                            const colors = ['#6366f1', '#C9A84C', '#f97316', '#22c55e'];
                            return (
                              <td key={vi} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: v > 0 ? colors[vi] : 'var(--text3)' }}>
                                  {v}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: a.conversions > 0 ? '#22c55e' : 'var(--text3)' }}>
                              {fmtPct(a.conversions, a.landingViews)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', textAlign: 'right' }}>
                            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: 'var(--gold2)' }}>
                              {a.totalRevenue > 0 ? fmtRp(a.totalRevenue) : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ REFERRAL LOG ═══ */}
      {section === 'referrals' && (
        <div className="section">
          <div className="section-head">
            <span className="section-title">Referral Log</span>
            <div className="filter-bar">
              <select value={filterAffiliate} onChange={e => setFilterAffiliate(e.target.value)} className="filter-select">
                <option value="all">Semua Affiliate</option>
                {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="filter-select">
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          {filteredReferrals.length === 0 ? (
            <div className="empty-state">Tidak ada data referral.</div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <TH>Tanggal</TH><TH>Affiliate</TH><TH>Pembeli</TH>
                    <TH>Paket</TH><TH>Harga</TH><TH>Komisi</TH><TH>Status</TH><TH>Batch</TH>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map((r, i) => {
                    const aff = affiliates.find(a => a.id === r.affiliate_id);
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 1 ? 'var(--row-alt)' : 'transparent' }}>
                        <td className="date-text" style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', whiteSpace: 'nowrap' }}>
                          {fmtDate(r.created_at)}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontWeight: 600, color: 'var(--gold2)', fontSize: 13 }}>
                          {aff?.name ?? '—'}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)' }}>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{r.buyer_name || '—'}</div>
                          <div className="email-text">{r.buyer_email}</div>
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)' }}>
                          <span className={`badge ${r.plan_type === 'elite' ? 'plan-elite' : r.plan_type === 'pro' ? 'plan-pro' : 'plan-basic'}`}>
                            {r.plan_type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text2)' }}>
                          {fmtRp(r.plan_price)}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: 'var(--gold2)' }}>
                          {fmtRp(r.commission)}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)' }}>
                          <span className={`badge ${r.status === 'paid' ? 'used' : 'unused'}`}>
                            <span className="dot" />{r.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="date-text" style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontSize: 10 }}>
                          {r.payout_batch ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{
            padding: '13px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg3)',
          }}>
            <span className="date-text">Total komisi pending (filter aktif)</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: 'var(--gold2)' }}>
              {fmtRp(filteredReferrals.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0))}
            </span>
          </div>
        </div>
      )}

      {/* ═══ ANALITIK ═══ */}
      {section === 'analytics' && (
        <>
          <div className="section" style={{ marginBottom: 14 }}>
            <div className="section-head">
              <span className="section-title">Filter Analitik</span>
              <select value={analyticsAffiliate} onChange={e => setAnalyticsAffiliate(e.target.value)} className="filter-select">
                <option value="all">Semua Affiliate</option>
                {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="analytics-stats">
            {[
              { lbl: 'Total Referral', val: String(analyticsRefs.length), cls: '', sub: `${analyticsRefs.filter(r => r.status === 'paid').length} sudah paid` },
              { lbl: 'Total Revenue',  val: fmtRp(totalRevenue),    cls: 'gold', sub: 'dari semua transaksi' },
              { lbl: 'Total Komisi',   val: fmtRp(totalCommission), cls: 'gold', sub: `dibayar: ${fmtRp(totalPaid)}` },
              { lbl: 'Komisi Pending', val: fmtRp(totalPendingAll), cls: totalPendingAll > 0 ? 'gold' : '', sub: 'belum dibayarkan' },
            ].map(s => (
              <div key={s.lbl} className="a-card">
                <div className="a-card-lbl">{s.lbl}</div>
                <div className={`a-card-val ${s.cls}`}>{s.val}</div>
                <div className="a-card-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="analytics-grid">
            <div className="chart-box">
              <div className="chart-box-title">Referral per Bulan (6 Bulan Terakhir)</div>
              {analyticsRefs.length === 0
                ? <div className="empty-state" style={{ padding: '28px 0', fontSize: 12 }}>Belum ada data</div>
                : <BarChart data={monthlyData} color="#C9A84C" />}
            </div>
            <div className="chart-box">
              <div className="chart-box-title">Revenue per Bulan (Ribuan Rp)</div>
              {analyticsRefs.length === 0
                ? <div className="empty-state" style={{ padding: '28px 0', fontSize: 12 }}>Belum ada data</div>
                : <BarChart data={revenueData} color="#22C55E" />}
            </div>
          </div>

          <div className="analytics-grid">
            <div className="chart-box">
              <div className="chart-box-title">Breakdown per Paket</div>
              {planBreakdown.every(p => p.count === 0)
                ? <div className="empty-state" style={{ padding: '24px 0', fontSize: 12 }}>Belum ada data</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                    {planBreakdown.map(p => {
                      const pct = analyticsRefs.length > 0 ? Math.round(p.count / analyticsRefs.length * 100) : 0;
                      const barColor = p.plan === 'elite' ? '#F97316' : p.plan === 'pro' ? 'var(--gold)' : 'var(--blue)';
                      return (
                        <div key={p.plan}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                            <span className={`badge ${p.plan === 'elite' ? 'plan-elite' : p.plan === 'pro' ? 'plan-pro' : 'plan-basic'}`}>
                              {p.plan.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text2)' }}>
                              {p.count}× · {fmtRp(p.revenue)}
                            </span>
                          </div>
                          <div style={{ height: 7, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: barColor, transition: 'width .8s ease' }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>
                            {pct}% dari total
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>

            <div className="chart-box">
              <div className="chart-box-title">Top Affiliate by Referral</div>
              {affiliates.length === 0
                ? <div className="empty-state" style={{ padding: '24px 0', fontSize: 12 }}>Belum ada data</div>
                : (
                  <div className="ranking-list" style={{ marginTop: 8 }}>
                    {[...affiliates]
                      .sort((a, b) => b.totalReferrals - a.totalReferrals)
                      .slice(0, 5)
                      .map((a, i) => (
                        <div key={a.id} className="rank-row">
                          <div className={`rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                            #{i + 1}
                          </div>
                          <div className="rank-info">
                            <div className="rank-email">{a.name}</div>
                            <div className="rank-meta">{a.affiliate_code} · {fmtRp(a.totalRevenue)}</div>
                          </div>
                          <div className="rank-badge">{a.totalReferrals} ref</div>
                        </div>
                      ))}
                  </div>
                )}
            </div>
          </div>
        </>
      )}

      {/* ═══ PAYOUT ═══ */}
      {section === 'payout' && (
        <div className="section">
          <div className="section-head">
            <span className="section-title">Payout Management</span>
            <div className="filter-bar">
              <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Affiliate:</label>
              <select value={payoutAffiliate} onChange={e => setPayoutAffiliate(e.target.value)} className="filter-select">
                <option value="all">Semua Affiliate</option>
                {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="section-body">
            {pendingForPayout.length === 0 ? (
              <div className="empty-state">Tidak ada referral pending untuk affiliate ini.</div>
            ) : (
              <>
                {payoutAffiliate !== 'all' && (() => {
                  const aff = affiliates.find(a => a.id === payoutAffiliate);
                  if (!aff) return null;
                  return (
                    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Info Rekening</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
                        {[['Bank', aff.bank_name], ['No. Rekening', aff.bank_account],
                          ['Atas Nama', aff.bank_holder], ['WhatsApp', aff.phone]].map(([lbl, val]) => (
                          <div key={lbl}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{lbl}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: val ? 'var(--text)' : 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>{val || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                      <tr><TH>Tanggal</TH><TH>Affiliate</TH><TH>Pembeli</TH><TH>Paket</TH><TH>Komisi</TH></tr>
                    </thead>
                    <tbody>
                      {pendingForPayout.map((r, i) => {
                        const aff = affiliates.find(a => a.id === r.affiliate_id);
                        return (
                          <tr key={r.id} style={{ background: i % 2 === 1 ? 'var(--row-alt)' : 'transparent' }}>
                            <td className="date-text" style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                            <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', color: 'var(--gold2)', fontWeight: 600, fontSize: 13 }}>{aff?.name ?? '—'}</td>
                            <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)' }}>
                              <div style={{ fontSize: 13, color: 'var(--text)' }}>{r.buyer_name || '—'}</div>
                              <div className="email-text">{r.buyer_email}</div>
                            </td>
                            <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)' }}>
                              <span className={`badge ${r.plan_type === 'elite' ? 'plan-elite' : r.plan_type === 'pro' ? 'plan-pro' : 'plan-basic'}`}>
                                {r.plan_type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: 'var(--gold2)' }}>
                              {fmtRp(r.commission)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
                      {pendingForPayout.length} referral · batch {getPayoutBatch()}
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 700, color: 'var(--gold2)' }}>
                      {fmtRp(payoutTotal)}
                    </div>
                  </div>
                  <div className="action-btns">
                    {!payoutConfirming ? (
                      <button className="gen-btn" onClick={() => setPayoutConfirming(true)}>✓ Mark All Paid</button>
                    ) : (
                      <>
                        <button className="refresh-btn" onClick={() => setPayoutConfirming(false)}>Batal</button>
                        <button className="gen-btn" onClick={handleMarkPaid}>✓ Konfirmasi Sudah Dibayar</button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {modalOpen && (
        <div id="modal-overlay" className="show"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">{editTarget ? 'Edit Affiliate' : 'Tambah Affiliate'}</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {formError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 12, marginBottom: 16 }}>
                  ⚠️ {formError}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Nama *</label>
                  <input style={iStyle} value={form.name} placeholder="contoh: Ilham Pratama" onChange={e => handleNameChange(e.target.value)} />
                </div>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Email *</label>
                  <input style={iStyle} type="email" value={form.email} placeholder="email@partner.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Nomor WhatsApp</label>
                  <input style={iStyle} value={form.phone ?? ''} placeholder="628xxxxxxxxxx" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Kode Affiliate * (uppercase, maks 12 karakter)</label>
                  <input style={{ ...iStyle, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 3, color: 'var(--gold2)', fontSize: 14 }}
                    value={form.affiliate_code} placeholder="ILHAM10" maxLength={12}
                    onChange={e => setForm(f => ({
                      ...f,
                      affiliate_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
                      affiliate_slug: e.target.value.toLowerCase().replace(/[^A-Z0-9]/gi, '').slice(0, 12),
                    }))} />
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                    Link: <span style={{ color: 'var(--gold)' }}>{BASE_URL}/?ref={form.affiliate_code.toLowerCase() || 'slug'}</span>
                  </div>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
                  <div className="gen-field">
                    <label>Nama Bank</label>
                    <input style={iStyle} value={form.bank_name ?? ''} placeholder="BCA / BRI / Mandiri" onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
                  </div>
                  <div className="gen-field">
                    <label>No. Rekening</label>
                    <input style={iStyle} value={form.bank_account ?? ''} placeholder="1234567890" onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} />
                  </div>
                </div>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Nama Pemilik Rekening</label>
                  <input style={iStyle} value={form.bank_holder ?? ''} placeholder="Ilham Pratama" onChange={e => setForm(f => ({ ...f, bank_holder: e.target.value }))} />
                </div>
                <div className="gen-field" style={{ width: '100%' }}>
                  <label>Catatan Internal</label>
                  <textarea style={{ ...iStyle, resize: 'vertical', minHeight: 68, fontFamily: "'Outfit',sans-serif" } as React.CSSProperties}
                    value={form.notes ?? ''} placeholder="Catatan untuk admin..." rows={3}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    style={{ width: 40, height: 22, borderRadius: 11, background: form.is_active ? 'var(--gold)' : 'var(--bg4)', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: form.is_active ? 20 : 4, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </button>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: form.is_active ? 'var(--gold2)' : 'var(--text3)' }}>
                    {form.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="modal-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Batal</button>
              <button className="gen-btn" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" />Menyimpan...</> : editTarget ? 'Simpan Perubahan' : 'Tambah Affiliate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}