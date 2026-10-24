'use client';

// components/admin/AffiliatePanel.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UsersThree, Funnel, ClipboardText, ChartBar, Money, ArrowsClockwise,
  Copy, DotsThree, MagnifyingGlass, Plus, X, PencilSimple, Power, Wallet,
  Warning, LinkSimple, DownloadSimple, WhatsappLogo, Eye, Info,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { fmtDate } from '@/lib/adminHelpers';
import { COMMISSION_MAP, PRICE_MAP } from '@/lib/affiliateConfig';
import './affiliate.css';

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
  referrer?: string | null;
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
  planSelects: number;
  checkoutStarts: number;
  conversions: number;
  orderGap: number; // sesi yang lanjut ke pilih paket/checkout tanpa event order_view
}

type Section = 'list' | 'funnel' | 'referrals' | 'analytics' | 'payout';
type StatusFilter = 'all' | 'active' | 'inactive';

const TABS: { id: Section; label: string; Icon: Icon }[] = [
  { id: 'list',      label: 'Affiliate',    Icon: UsersThree },
  { id: 'funnel',    label: 'Funnel',       Icon: Funnel },
  { id: 'referrals', label: 'Referral Log', Icon: ClipboardText },
  { id: 'analytics', label: 'Analitik',     Icon: ChartBar },
  { id: 'payout',    label: 'Payout',       Icon: Money },
];

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

function refLink(a: Affiliate) {
  return `${BASE_URL}/?ref=${a.affiliate_code.toLowerCase()}`;
}

// Tanda untuk partner yang perlu perhatian admin
function getFlag(a: AffiliateWithStats): { label: string; hint: string } | null {
  if (a.landingViews >= 20 && a.conversions === 0) {
    return {
      label: 'Belum ada pembelian',
      hint: `${a.landingViews} kunjungan, belum ada yang membeli.`,
    };
  }
  return null;
}

// ── Funnel: dihitung per SESI pengunjung (bukan per event) ──────────────────
// Satu pengunjung yang reload halaman atau klik beberapa paket tetap dihitung satu kali.
// Tahap yang tercapai otomatis menghitung tahap sebelumnya, jadi funnel tidak pernah
// "naik" (mis. checkout > order page) walau ada event yang gagal tercatat.
interface FunnelCounts {
  landing: number; order: number; plan: number; checkout: number; paid: number;
  orderGap: number;
}

function stageOf(e: LinkEvent): number {
  if (e.event_type === 'landing_view' || (e.event_type === 'view' && e.page === 'landing')) return 0;
  if (e.event_type === 'order_view'   || (e.event_type === 'view' && e.page === 'order'))   return 1;
  if (e.event_type === 'plan_select') return 2;
  if (e.event_type === 'checkout_start') return 3;
  return -1;
}

function sessionKey(e: LinkEvent): string {
  return e.session_id || `evt-${e.id}`;
}

function buildFunnel(evts: LinkEvent[], paid: number): FunnelCounts {
  const sessions = new Map<string, { max: number; stages: Set<number> }>();
  const exact = [0, 0, 0, 0]; // event tanpa session_id: dihitung apa adanya per tahap
  evts.forEach(e => {
    const st = stageOf(e);
    if (st < 0) return;
    if (!e.session_id) { exact[st]++; return; }
    const cur = sessions.get(e.session_id) ?? { max: -1, stages: new Set<number>() };
    cur.max = Math.max(cur.max, st);
    cur.stages.add(st);
    sessions.set(e.session_id, cur);
  });

  const reach = [exact[0], exact[1], exact[2], exact[3]];
  let orderGap = 0;
  sessions.forEach(sess => {
    for (let k = 0; k <= sess.max; k++) reach[k]++;
    if (sess.max >= 2 && !sess.stages.has(1)) orderGap++;
  });

  // Pembelian tanpa event checkout tetap mengangkat tahap-tahap sebelumnya
  const checkout = Math.max(reach[3], paid);
  const plan     = Math.max(reach[2], checkout);
  const order    = Math.max(reach[1], plan);
  const landing  = Math.max(reach[0], order);
  return { landing, order, plan, checkout, paid, orderGap };
}

function uniqueSessions(evts: LinkEvent[]): number {
  return new Set(evts.map(sessionKey)).size;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ambil semua event per halaman 1000 baris (batas default API Supabase)
const EVENT_COLS = 'id, created_at, affiliate_code, event_type, page, session_id, plan_type';
async function fetchAllEvents(): Promise<LinkEvent[]> {
  const pageSize = 1000;
  const all: LinkEvent[] = [];
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await _sbAdmin
      .from('affiliate_link_events')
      .select(EVENT_COLS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    all.push(...(data as LinkEvent[]));
    if (data.length < pageSize) break;
  }
  return all;
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

// ── Grafik tren harian: kunjungan (garis) + hari ada pembelian (titik hijau) ──
function TrendChart({ data }: { data: { label: string; visits: number; buys: number }[] }) {
  const W = 640; const H = 170;
  const padL = 30; const padR = 10; const padT = 16; const padB = 28;
  const max = Math.max(...data.map(d => d.visits), 1);
  const stepX = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0;
  const yOf = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const pts = data.map((d, i) => ({ x: padL + i * stepX, y: yOf(d.visits), d }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - padB} L${pts[0].x.toFixed(1)} ${H - padB} Z`;
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  const labelEvery = data.length > 14 ? 5 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="aff-trend" role="img" aria-label="Kunjungan per hari">
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} className="aff-trend-grid" />
          <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" className="aff-trend-txt">{t}</text>
        </g>
      ))}
      <path d={area} className="aff-trend-area" />
      <path d={line} className="aff-trend-line" />
      {pts.map((p, i) => (
        <g key={i}>
          {p.d.visits > 0 && <circle cx={p.x} cy={p.y} r={2.5} className="aff-trend-dot" />}
          {p.d.buys > 0 && (
            <>
              <circle cx={p.x} cy={H - padB} r={5} className="aff-trend-buy">
                <title>{`${p.d.label}: ${p.d.buys} pembelian`}</title>
              </circle>
              <text x={p.x} y={H - padB - 10} textAnchor="middle" className="aff-trend-buy-txt">{p.d.buys}</text>
            </>
          )}
          {i % labelEvery === 0 && (
            <text x={p.x} y={H - 8} textAnchor="middle" className="aff-trend-txt">{p.d.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function AffiliatePanel({ active }: { active: boolean }) {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([]);
  const [referrals,  setReferrals]  = useState<Referral[]>([]);
  const [events,     setEvents]     = useState<LinkEvent[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);

  const [section, setSection] = useState<Section>('list');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Affiliate | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState('');

  const [filterAffiliate,   setFilterAffiliate]   = useState('all');
  const [filterStatus,      setFilterStatus]      = useState<'all' | 'pending' | 'paid'>('all');
  const [analyticsAffiliate, setAnalyticsAffiliate] = useState('all');
  const [funnelAffiliate,   setFunnelAffiliate]   = useState('all');
  const [funnelRange,       setFunnelRange]       = useState<'all' | '7' | '30'>('all');
  const [payoutAffiliate,   setPayoutAffiliate]   = useState('all');
  const [payoutConfirming,  setPayoutConfirming]  = useState(false);

  // Tab Affiliate: pencarian, filter, drawer, menu, konfirmasi
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [drawerId,     setDrawerId]     = useState<string | null>(null);
  const [menu,         setMenu]         = useState<{ a: AffiliateWithStats; top: number; right: number } | null>(null);
  const [confirmOff,   setConfirmOff]   = useState<AffiliateWithStats | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      showToast('Gagal menyalin. Salin manual dari kolom.', false);
    }
  }

  // ── Load ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: affData }, { data: refData }, { data: evData }] = await Promise.all([
        _sbAdmin.from('affiliates').select('*').order('created_at', { ascending: false }),
        _sbAdmin.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
        fetchAllEvents().then(d => ({ data: d })),
      ]);

      const refs   = (refData ?? []) as Referral[];
      const evts   = (evData  ?? []) as LinkEvent[];
      setReferrals(refs);
      setEvents(evts);

      const withStats: AffiliateWithStats[] = (affData ?? []).map((a) => {
        const mine     = refs.filter(r => r.affiliate_id === a.id);
        const myEvents = evts.filter(e => e.affiliate_code === a.affiliate_code.toLowerCase());
        const f = buildFunnel(myEvents, mine.length);

        return {
          ...(a as Affiliate),
          totalReferrals:  mine.length,
          totalPending:    mine.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0),
          totalRevenue:    mine.reduce((s, r) => s + r.plan_price, 0),
          landingViews:    f.landing,
          orderViews:      f.order,
          planSelects:     f.plan,
          checkoutStarts:  f.checkout,
          conversions:     f.paid,
          orderGap:        f.orderGap,
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

  // Esc menutup menu, drawer, dan konfirmasi
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenu(null); setConfirmOff(null); setDrawerId(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // ── Ringkasan & daftar (tab Affiliate) ─────────────────────────────────
  const summary = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const paidRefs = referrals.filter(r => r.status === 'paid');
    const landing  = affiliates.reduce((s, a) => s + a.landingViews, 0);
    const conv     = affiliates.reduce((s, a) => s + a.conversions, 0);
    return {
      activeCount:   affiliates.filter(a => a.is_active).length,
      landing,
      conv,
      pending:       affiliates.reduce((s, a) => s + a.totalPending, 0),
      pendingCount:  referrals.filter(r => r.status === 'pending').length,
      paid:          paidRefs.reduce((s, r) => s + r.commission, 0),
      paidThisMonth: paidRefs.filter(r => (r.paid_at ?? '').startsWith(monthKey)).reduce((s, r) => s + r.commission, 0),
    };
  }, [affiliates, referrals]);

  const paidByAffiliate = useMemo(() => {
    const map: Record<string, number> = {};
    referrals.forEach(r => {
      if (r.status === 'paid') map[r.affiliate_id] = (map[r.affiliate_id] ?? 0) + r.commission;
    });
    return map;
  }, [referrals]);

  const counts = useMemo(() => ({
    all: affiliates.length,
    active: affiliates.filter(a => a.is_active).length,
    inactive: affiliates.filter(a => !a.is_active).length,
  }), [affiliates]);

  const visibleAffiliates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return affiliates.filter(a => {
      if (statusFilter === 'active' && !a.is_active) return false;
      if (statusFilter === 'inactive' && a.is_active) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q)
        || a.email.toLowerCase().includes(q)
        || a.affiliate_code.toLowerCase().includes(q);
    });
  }, [affiliates, search, statusFilter]);

  // ── Drawer detail ──────────────────────────────────────────────────────
  const drawerAff = drawerId ? affiliates.find(a => a.id === drawerId) ?? null : null;
  const drawerRefs = drawerAff ? referrals.filter(r => r.affiliate_id === drawerAff.id) : [];
  const drawerSteps = drawerAff ? [
    { lbl: 'Kunjungan',   val: drawerAff.landingViews },
    { lbl: 'Order page',  val: drawerAff.orderViews },
    { lbl: 'Pilih paket', val: drawerAff.planSelects },
    { lbl: 'Checkout',    val: drawerAff.checkoutStarts },
    { lbl: 'Bayar',       val: drawerAff.conversions },
  ] : [];
  const drawerMax = Math.max(...drawerSteps.map(s => s.val), 1);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, a: AffiliateWithStats) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const menuH = 190;
    const top = r.bottom + 6 + menuH > window.innerHeight ? Math.max(8, r.top - 6 - menuH) : r.bottom + 6;
    setMenu({ a, top, right: Math.max(8, window.innerWidth - r.right) });
  }

  function requestToggle(a: AffiliateWithStats) {
    setMenu(null);
    if (a.is_active) { setDrawerId(null); setConfirmOff(a); }
    else toggleActive(a);
  }

  function goPayout(a: AffiliateWithStats) {
    setMenu(null); setDrawerId(null);
    setPayoutAffiliate(a.id); setPayoutConfirming(false); setSection('payout');
  }

  // ── Funnel data (tab Funnel) ───────────────────────────────────────────
  const funnelData = useMemo(() => {
    const since = funnelRange === 'all' ? 0 : Date.now() - Number(funnelRange) * 86400000;
    const inRange = (iso: string) => since === 0 || new Date(iso).getTime() >= since;
    const evs  = events.filter(e => inRange(e.created_at));
    const refs = referrals.filter(r => inRange(r.created_at));

    const target = funnelAffiliate === 'all' ? null : affiliates.find(a => a.id === funnelAffiliate) ?? null;
    const code   = target?.affiliate_code.toLowerCase();
    const fEvents = target ? evs.filter(e => e.affiliate_code === code) : evs;
    const fRefs   = target ? refs.filter(r => r.affiliate_id === target.id) : refs;

    const totals = buildFunnel(fEvents, fRefs.length);

    const steps = [
      { lbl: 'Kunjungan',   desc: 'buka halaman landing',    val: totals.landing },
      { lbl: 'Order page',  desc: 'buka halaman order',      val: totals.order },
      { lbl: 'Pilih paket', desc: 'pilih salah satu paket',  val: totals.plan },
      { lbl: 'Checkout',    desc: 'klik tombol bayar',       val: totals.checkout },
      { lbl: 'Bayar',       desc: 'pembayaran berhasil',     val: totals.paid },
    ];

    // Titik bocor terbesar = transisi dengan persentase kehilangan tertinggi
    let leak: { from: string; to: string; lost: number; of: number; pct: number } | null = null;
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1].val; const cur = steps[i].val;
      if (prev <= 0) continue;
      const pct = (prev - cur) / prev;
      if (!leak || pct > leak.pct) leak = { from: steps[i - 1].lbl, to: steps[i].lbl, lost: prev - cur, of: prev, pct };
    }

    const plans = ['basic', 'pro', 'elite'].map(p => ({
      plan: p,
      selects: uniqueSessions(fEvents.filter(e => e.event_type === 'plan_select' && e.plan_type === p)),
      bought: fRefs.filter(r => r.plan_type === p).length,
    }));

    // Tren harian (7 atau 30 hari terakhir)
    const days = funnelRange === '7' ? 7 : 30;
    const visitsByDay = new Map<string, Set<string>>();
    fEvents.forEach(e => {
      if (stageOf(e) < 0) return;
      const k = dayKey(new Date(e.created_at));
      const set = visitsByDay.get(k) ?? new Set<string>();
      set.add(sessionKey(e));
      visitsByDay.set(k, set);
    });
    const buysByDay = new Map<string, number>();
    fRefs.forEach(r => {
      const k = dayKey(new Date(r.created_at));
      buysByDay.set(k, (buysByDay.get(k) ?? 0) + 1);
    });
    const trend: { label: string; visits: number; buys: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = dayKey(d);
      trend.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, visits: visitsByDay.get(k)?.size ?? 0, buys: buysByDay.get(k) ?? 0 });
    }

    const perAffiliate = affiliates.map(a => {
      const c = a.affiliate_code.toLowerCase();
      const ar = refs.filter(r => r.affiliate_id === a.id);
      return { a, f: buildFunnel(evs.filter(e => e.affiliate_code === c), ar.length), revenue: ar.reduce((sum, r) => sum + r.plan_price, 0) };
    }).sort((x, y) => y.f.paid - x.f.paid || y.f.landing - x.f.landing);

    return { target, totals, steps, leak, plans, trend, days, perAffiliate };
  }, [events, referrals, affiliates, funnelAffiliate, funnelRange]);

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
    setDrawerId(null); setMenu(null);
    setEditTarget(null); setForm({ ...EMPTY_FORM }); setFormError(''); setModalOpen(true);
  }
  function openEdit(a: Affiliate) {
    setDrawerId(null); setMenu(null);
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

  // Export CSV (ikut filter Referral Log yang aktif)
  function exportReferralsCsv() {
    const header = ['Tanggal', 'Affiliate', 'Kode', 'Pembeli', 'Email', 'Paket', 'Harga', 'Komisi', 'Status', 'Batch'];
    const rows = filteredReferrals.map(r => {
      const aff = affiliates.find(a => a.id === r.affiliate_id);
      return [
        r.created_at.slice(0, 10), aff?.name ?? '', aff?.affiliate_code ?? '',
        r.buyer_name ?? '', r.buyer_email, r.plan_type, r.plan_price, r.commission,
        r.status, r.payout_batch ?? '',
      ];
    });
    // Awali sel teks berbahaya (=, +, -, @) dengan petik agar tidak dieksekusi sebagai formula Excel
    const esc = (v: string | number) => {
      let s = String(v);
      if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [header, ...rows].map(row => row.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `referral-affiliate-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${rows.length} baris diekspor.`);
  }

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
        <div role="status" style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          background: 'var(--bg2)', border: `1px solid ${toast.ok ? 'var(--green-bd)' : 'var(--red-bd)'}`,
          color: toast.ok ? 'var(--green)' : 'var(--red)', borderRadius: 12, padding: '12px 20px',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, boxShadow: 'var(--shadow)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="aff-head">
        <div>
          <h2 className="aff-title">Sistem Affiliate</h2>
          <p className="aff-subtitle">Kelola partner, pantau funnel, dan bayar komisi.</p>
        </div>
        <div className="aff-head-actions">
          <button className="aff-btn" onClick={loadData} disabled={loading}>
            {loading ? <><span className="spinner" />Memuat...</> : <><ArrowsClockwise size={15} />Refresh</>}
          </button>
          <button className="aff-btn aff-btn-gold" onClick={openAdd}>
            <Plus size={15} weight="bold" />Tambah affiliate
          </button>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="aff-tabs" role="tablist" aria-label="Menu affiliate">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={section === id}
            className={`aff-tab${section === id ? ' is-active' : ''}`}
            onClick={() => setSection(id)}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {/* ═══ LIST ═══ */}
      {section === 'list' && (
        <>
          <div className="aff-stats">
            <div className="aff-stat">
              <div className="aff-stat-lbl">Partner aktif</div>
              <div className="aff-stat-val">{summary.activeCount}</div>
              <div className="aff-stat-sub">dari {affiliates.length} partner</div>
            </div>
            <div className="aff-stat">
              <div className="aff-stat-lbl">Konversi</div>
              <div className="aff-stat-val">{summary.conv}</div>
              <div className="aff-stat-sub">{fmtPct(summary.conv, summary.landing)} dari {summary.landing.toLocaleString('id-ID')} kunjungan</div>
            </div>
            <div className="aff-stat">
              <div className="aff-stat-lbl">Komisi pending</div>
              <div className={`aff-stat-val${summary.pending > 0 ? ' is-gold' : ''}`}>{fmtRp(summary.pending)}</div>
              <div className="aff-stat-sub">{summary.pendingCount} referral menunggu dibayar</div>
            </div>
            <div className="aff-stat">
              <div className="aff-stat-lbl">Sudah dibayar</div>
              <div className="aff-stat-val">{fmtRp(summary.paid)}</div>
              <div className="aff-stat-sub">bulan ini {fmtRp(summary.paidThisMonth)}</div>
            </div>
          </div>

          <div className="aff-card">
            <div className="aff-toolbar">
              <div className="aff-search">
                <MagnifyingGlass size={16} />
                <input type="search" value={search} placeholder="Cari nama, email, atau kode"
                  aria-label="Cari affiliate" onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="aff-seg" role="group" aria-label="Filter status">
                {([['all', 'Semua'], ['active', 'Aktif'], ['inactive', 'Nonaktif']] as const).map(([id, lbl]) => (
                  <button key={id} className={statusFilter === id ? 'is-active' : ''}
                    aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)}>
                    {lbl}<b>{counts[id]}</b>
                  </button>
                ))}
              </div>
            </div>

            {loading && !affiliates.length ? (
              <div aria-busy="true" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map(i => <div key={i} className="aff-skel" style={{ height: 44 }} />)}
              </div>
            ) : affiliates.length === 0 ? (
              <div className="aff-empty">
                <strong>Belum ada affiliate</strong>
                Tambahkan partner pertama untuk mulai melacak klik, konversi, dan komisi.
                <div><button className="aff-btn aff-btn-gold" onClick={openAdd}><Plus size={15} weight="bold" />Tambah affiliate</button></div>
              </div>
            ) : visibleAffiliates.length === 0 ? (
              <div className="aff-empty">
                <strong>Tidak ada partner yang cocok</strong>
                Ubah kata kunci atau filter status.
              </div>
            ) : (
              <div className="aff-table-wrap">
                <table className="aff-table">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Kode & link</th>
                      <th>Status</th>
                      <th>Funnel</th>
                      <th className="aff-th-right">Conv. rate</th>
                      <th className="aff-th-right">Komisi pending</th>
                      <th className="aff-th-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAffiliates.map(a => {
                      const flag = getFlag(a);
                      const paid = paidByAffiliate[a.id] ?? 0;
                      const steps = [
                        { lbl: 'Kunjungan', tip: 'Buka halaman landing', val: a.landingViews, win: false },
                        { lbl: 'Order page', tip: 'Buka halaman order', val: a.orderViews, win: false },
                        { lbl: 'Checkout', tip: 'Klik tombol bayar', val: a.checkoutStarts, win: false },
                        { lbl: 'Bayar', tip: 'Pembayaran berhasil', val: a.conversions, win: true },
                      ];
                      return (
                        <tr key={a.id} className={`aff-row${a.is_active ? '' : ' is-off'}`}
                          onClick={() => setDrawerId(a.id)}>
                          <td>
                            <button className="aff-name-btn"
                              onClick={e => { e.stopPropagation(); setDrawerId(a.id); }}>
                              {a.name}
                            </button>
                            <div className="aff-sub">{a.email}</div>
                          </td>
                          <td>
                            <div className="aff-code-row">
                              <span className="aff-code">{a.affiliate_code}</span>
                              <button className="aff-icon-btn" aria-label={`Salin link referral ${a.name}`}
                                title="Salin link referral"
                                onClick={e => { e.stopPropagation(); copyText(refLink(a), 'Link referral disalin!'); }}>
                                <Copy size={15} />
                              </button>
                            </div>
                            <div className="aff-sub aff-mono">/?ref={a.affiliate_code.toLowerCase()}</div>
                          </td>
                          <td>
                            <span className={`aff-chip${a.is_active ? ' is-on' : ''}`}>
                              {a.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td>
                            <div className="aff-funnel">
                              {steps.map(s => (
                                <div key={s.lbl} className="aff-fn-step" title={s.tip}>
                                  <span className={`aff-fn-val${s.val === 0 ? ' is-zero' : s.win ? ' is-win' : ''}`}>
                                    {s.val}
                                  </span>
                                  <span className="aff-fn-lbl">{s.lbl}</span>
                                </div>
                              ))}
                            </div>
                            {flag && (
                              <div className="aff-flag" title={flag.hint}>
                                <Warning size={13} weight="fill" />{flag.label}
                              </div>
                            )}
                          </td>
                          <td className="aff-td-right">
                            <span className={`aff-rate${a.conversions > 0 ? ' is-win' : ''}`}>
                              {fmtPct(a.conversions, a.landingViews)}
                            </span>
                          </td>
                          <td className="aff-td-right">
                            <span className={`aff-money${a.totalPending > 0 ? ' is-gold' : ''}`}>
                              {a.totalPending > 0 ? fmtRp(a.totalPending) : '—'}
                            </span>
                            {paid > 0 && <div className="aff-sub">dibayar {fmtRp(paid)}</div>}
                          </td>
                          <td>
                            <div className="aff-actions">
                              {a.totalPending > 0 && (
                                <button className="aff-btn aff-btn-gold aff-btn-sm"
                                  onClick={e => { e.stopPropagation(); goPayout(a); }}>
                                  Bayar
                                </button>
                              )}
                              <button className="aff-icon-btn" aria-label={`Edit ${a.name}`} title="Edit"
                                onClick={e => { e.stopPropagation(); openEdit(a); }}>
                                <PencilSimple size={16} />
                              </button>
                              <button className="aff-icon-btn" aria-label={`Menu lainnya untuk ${a.name}`}
                                aria-haspopup="menu" title="Lainnya"
                                onClick={e => openMenu(e, a)}>
                                <DotsThree size={20} weight="bold" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {affiliates.length > 0 && (
              <div className="aff-legend">
                <span><b>Kunjungan</b> buka halaman landing</span>
                <span><b>Order page</b> buka halaman order</span>
                <span><b>Checkout</b> klik tombol bayar</span>
                <span><b>Bayar</b> pembayaran berhasil</span>
                <span>Dihitung per sesi pengunjung.</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Menu titik tiga */}
      {menu && (
        <>
          <div className="aff-menu-backdrop" onClick={() => setMenu(null)} />
          <div className="aff-menu" role="menu" style={{ top: menu.top, right: menu.right }}>
            <button role="menuitem" onClick={() => { setDrawerId(menu.a.id); setMenu(null); }}>
              <Eye size={16} />Lihat detail
            </button>
            <button role="menuitem" onClick={() => { copyText(refLink(menu.a), 'Link referral disalin!'); setMenu(null); }}>
              <LinkSimple size={16} />Salin link referral
            </button>
            {menu.a.dashboard_token && (
              <button role="menuitem" onClick={() => {
                copyText(`${BASE_URL}/affiliate/dashboard?token=${menu.a.dashboard_token}`, 'Link dashboard partner disalin!');
                setMenu(null);
              }}>
                <ChartBar size={16} />Salin link dashboard partner
              </button>
            )}
            {menu.a.totalPending > 0 && (
              <button role="menuitem" onClick={() => goPayout(menu.a)}>
                <Wallet size={16} />Bayar komisi
              </button>
            )}
            <hr />
            <button role="menuitem" className={menu.a.is_active ? 'is-danger' : ''} onClick={() => requestToggle(menu.a)}>
              <Power size={16} />{menu.a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        </>
      )}

      {/* Drawer detail partner */}
      {drawerAff && (
        <>
          <div className="aff-scrim" onClick={() => setDrawerId(null)} />
          <aside className="aff-drawer" role="dialog" aria-modal="true" aria-label={`Detail ${drawerAff.name}`}>
            <div className="aff-dr-head">
              <div style={{ minWidth: 0 }}>
                <h3 className="aff-dr-name">{drawerAff.name}</h3>
                <div className="aff-sub" style={{ marginBottom: 10 }}>{drawerAff.email}</div>
                <span className={`aff-chip${drawerAff.is_active ? ' is-on' : ''}`}>
                  {drawerAff.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <button className="aff-icon-btn" aria-label="Tutup detail" onClick={() => setDrawerId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="aff-dr-body">
              <section className="aff-dr-sec">
                <h4>Link</h4>
                <dl className="aff-kv">
                  <dt>Kode</dt>
                  <dd><span className="aff-code">{drawerAff.affiliate_code}</span></dd>
                  <span />
                  <dt>Link referral</dt>
                  <dd>{refLink(drawerAff).replace('https://', '')}</dd>
                  <button className="aff-icon-btn" aria-label="Salin link referral"
                    onClick={() => copyText(refLink(drawerAff), 'Link referral disalin!')}>
                    <Copy size={15} />
                  </button>
                  <dt>Dashboard partner</dt>
                  {drawerAff.dashboard_token ? (
                    <>
                      <dd>/affiliate/dashboard</dd>
                      <button className="aff-icon-btn" aria-label="Salin link dashboard partner"
                        onClick={() => copyText(`${BASE_URL}/affiliate/dashboard?token=${drawerAff.dashboard_token}`, 'Link dashboard partner disalin!')}>
                        <Copy size={15} />
                      </button>
                    </>
                  ) : (
                    <><dd className="is-empty">Belum ada token</dd><span /></>
                  )}
                </dl>
              </section>

              <section className="aff-dr-sec">
                <h4>Funnel</h4>
                <div className="aff-steps">
                  {drawerSteps.map((s, i) => (
                    <div key={s.lbl}>
                      <div className="aff-step-top">
                        <span><b>{s.val}</b>{s.lbl}</span>
                        <span>{i === 0 ? '' : `${fmtPct(s.val, drawerSteps[i - 1].val)} dari tahap sebelumnya`}</span>
                      </div>
                      <div className="aff-bar">
                        <i className={i === drawerSteps.length - 1 ? 'is-win' : ''}
                          style={{ width: `${Math.round((s.val / drawerMax) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {getFlag(drawerAff) && (
                  <div className="aff-flag" style={{ marginTop: 12 }}>
                    <Warning size={13} weight="fill" />{getFlag(drawerAff)!.hint}
                  </div>
                )}
              </section>

              <section className="aff-dr-sec">
                <h4>Komisi</h4>
                <div className="aff-mini-stats">
                  <div className="aff-mini">
                    <span className="aff-stat-lbl">Pending</span>
                    <span className={`aff-money${drawerAff.totalPending > 0 ? ' is-gold' : ''}`}>{fmtRp(drawerAff.totalPending)}</span>
                  </div>
                  <div className="aff-mini">
                    <span className="aff-stat-lbl">Sudah dibayar</span>
                    <span className="aff-money">{fmtRp(paidByAffiliate[drawerAff.id] ?? 0)}</span>
                  </div>
                  <div className="aff-mini">
                    <span className="aff-stat-lbl">Total penjualan</span>
                    <span className="aff-money">{fmtRp(drawerAff.totalRevenue)}</span>
                  </div>
                </div>
                <dl className="aff-kv" style={{ marginTop: 14 }}>
                  <dt style={{ gridColumn: '1 / -1', marginBottom: 2 }}>Komisi per penjualan (sama untuk semua partner)</dt>
                  {(['basic', 'pro', 'elite'] as const).map(k => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt style={{ textTransform: 'capitalize' }}>{k}</dt>
                      <dd>{fmtRp(COMMISSION_MAP[k])} <span style={{ color: 'var(--text3)' }}>({Math.round((COMMISSION_MAP[k] / PRICE_MAP[k]) * 100)}% dari {fmtRp(PRICE_MAP[k])})</span></dd>
                      <span />
                    </div>
                  ))}
                </dl>
              </section>

              <section className="aff-dr-sec">
                <h4>Rekening & kontak</h4>
                <dl className="aff-kv">
                  <dt>Bank</dt>
                  <dd className={drawerAff.bank_name ? '' : 'is-empty'}>{drawerAff.bank_name || 'Belum diisi'}</dd>
                  <span />
                  <dt>No. rekening</dt>
                  <dd className={drawerAff.bank_account ? '' : 'is-empty'}>{drawerAff.bank_account || 'Belum diisi'}</dd>
                  {drawerAff.bank_account ? (
                    <button className="aff-icon-btn" aria-label="Salin nomor rekening"
                      onClick={() => copyText(drawerAff.bank_account!, 'Nomor rekening disalin!')}>
                      <Copy size={15} />
                    </button>
                  ) : <span />}
                  <dt>Atas nama</dt>
                  <dd className={drawerAff.bank_holder ? '' : 'is-empty'}>{drawerAff.bank_holder || 'Belum diisi'}</dd>
                  <span />
                  <dt>WhatsApp</dt>
                  {drawerAff.phone ? (
                    <>
                      <dd>
                        <a href={`https://wa.me/${drawerAff.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                          {drawerAff.phone}
                        </a>
                      </dd>
                      <WhatsappLogo size={16} color="var(--text3)" />
                    </>
                  ) : (
                    <><dd className="is-empty">Belum diisi</dd><span /></>
                  )}
                </dl>
              </section>

              <section className="aff-dr-sec">
                <h4>Referral terbaru</h4>
                {drawerRefs.length === 0 ? (
                  <div className="aff-sub">Belum ada pembelian lewat link partner ini.</div>
                ) : (
                  <div className="aff-ref-list">
                    {drawerRefs.slice(0, 5).map(r => (
                      <div key={r.id} className="aff-ref">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: 'var(--text)' }}>
                            {r.buyer_name || r.buyer_email}
                          </div>
                          <div className="aff-sub">{fmtDate(r.created_at)} · {r.plan_type}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="aff-money is-gold" style={{ fontSize: 17 }}>{fmtRp(r.commission)}</div>
                          <span className={`aff-chip${r.status === 'paid' ? ' is-on' : ' is-gold'}`} style={{ marginTop: 4 }}>
                            {r.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {drawerRefs.length > 5 && (
                  <button className="aff-btn aff-btn-sm" style={{ marginTop: 10 }}
                    onClick={() => { setFilterAffiliate(drawerAff.id); setFilterStatus('all'); setDrawerId(null); setSection('referrals'); }}>
                    Lihat semua {drawerRefs.length} referral
                  </button>
                )}
              </section>

              {drawerAff.notes && (
                <section className="aff-dr-sec">
                  <h4>Catatan internal</h4>
                  <div className="aff-note">{drawerAff.notes}</div>
                </section>
              )}
            </div>

            <div className="aff-dr-foot">
              {drawerAff.totalPending > 0 && (
                <button className="aff-btn aff-btn-gold" onClick={() => goPayout(drawerAff)}>
                  <Wallet size={15} />Bayar {fmtRp(drawerAff.totalPending)}
                </button>
              )}
              <button className="aff-btn" onClick={() => openEdit(drawerAff)}>
                <PencilSimple size={15} />Edit
              </button>
              <button className={`aff-btn${drawerAff.is_active ? ' aff-btn-danger' : ''}`}
                onClick={() => requestToggle(drawerAff)}>
                <Power size={15} />{drawerAff.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Konfirmasi nonaktifkan */}
      {confirmOff && (
        <div id="modal-overlay" className="show"
          onClick={e => { if (e.target === e.currentTarget) setConfirmOff(null); }}>
          <div className="modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true"
            onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Nonaktifkan {confirmOff.name}?</span>
              <button className="modal-close" aria-label="Tutup" onClick={() => setConfirmOff(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
                Partner tidak bisa membuka dashboard-nya selama nonaktif. Komisi pending
                ({fmtRp(confirmOff.totalPending)}) tetap tersimpan dan bisa dibayar kapan saja.
                Kamu bisa mengaktifkannya lagi dari menu yang sama.
              </p>
            </div>
            <div className="modal-foot">
              <button className="modal-cancel" onClick={() => setConfirmOff(null)}>Batal</button>
              <button className="gen-btn" onClick={() => { const a = confirmOff; setConfirmOff(null); toggleActive(a); }}>
                Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FUNNEL ═══ */}
      {section === 'funnel' && (() => {
        const { target, totals, steps, leak, plans, trend, days, perAffiliate } = funnelData;
        const top = Math.max(steps[0].val, 1);
        const maxSelect = Math.max(...plans.map(p => p.selects), 1);
        const rangeLabel = funnelRange === 'all' ? 'sepanjang waktu' : `${funnelRange} hari terakhir`;
        const hasTrend = trend.some(d => d.visits > 0 || d.buys > 0);
        return (
          <>
            <div className="aff-card" style={{ marginBottom: 14 }}>
              <div className="aff-toolbar">
                <select className="aff-select" value={funnelAffiliate} aria-label="Pilih affiliate"
                  onChange={e => setFunnelAffiliate(e.target.value)}>
                  <option value="all">Semua affiliate</option>
                  {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div className="aff-seg" role="group" aria-label="Periode">
                  {([['all', 'Semua'], ['30', '30 hari'], ['7', '7 hari']] as const).map(([id, lbl]) => (
                    <button key={id} className={funnelRange === id ? 'is-active' : ''}
                      aria-pressed={funnelRange === id} onClick={() => setFunnelRange(id)}>{lbl}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="aff-stats">
              <div className="aff-stat">
                <div className="aff-stat-lbl">Kunjungan</div>
                <div className="aff-stat-val">{totals.landing.toLocaleString('id-ID')}</div>
                <div className="aff-stat-sub">{target ? target.name : 'semua partner'}, {rangeLabel}</div>
              </div>
              <div className="aff-stat">
                <div className="aff-stat-lbl">Pilih paket</div>
                <div className="aff-stat-val">{totals.plan.toLocaleString('id-ID')}</div>
                <div className="aff-stat-sub">{fmtPct(totals.plan, totals.landing)} dari kunjungan</div>
              </div>
              <div className="aff-stat">
                <div className="aff-stat-lbl">Mulai checkout</div>
                <div className="aff-stat-val">{totals.checkout.toLocaleString('id-ID')}</div>
                <div className="aff-stat-sub">{fmtPct(totals.checkout, totals.plan)} dari yang pilih paket</div>
              </div>
              <div className="aff-stat">
                <div className="aff-stat-lbl">Pembelian</div>
                <div className={`aff-stat-val${totals.paid > 0 ? ' is-gold' : ''}`}>{totals.paid.toLocaleString('id-ID')}</div>
                <div className="aff-stat-sub">conv. rate {fmtPct(totals.paid, totals.landing)}</div>
              </div>
            </div>

            <div className="aff-two-col">
              <div className="aff-card">
                <div className="aff-card-head">
                  <h3 className="aff-card-title">Funnel konversi</h3>
                  <p className="aff-card-sub">Berapa sesi pengunjung yang lanjut di tiap tahap.</p>
                </div>
                <div className="aff-card-body">
                  <div className="aff-fchart">
                    {steps.map((st, i) => {
                      const isLeak = !!leak && leak.to === st.lbl && leak.lost > 0;
                      return (
                        <div key={st.lbl}>
                          <div className="aff-fchart-top">
                            <span className="aff-fchart-lbl">{st.lbl}<em>{st.desc}</em></span>
                            <span className="aff-fchart-num">
                              <b>{st.val.toLocaleString('id-ID')}</b>
                              {i > 0 && <span className={isLeak ? 'is-leak' : ''}>{fmtPct(st.val, steps[i - 1].val)} lanjut</span>}
                            </span>
                          </div>
                          <div className="aff-bar aff-bar-lg">
                            <i className={i === steps.length - 1 ? 'is-win' : ''}
                              style={{ width: `${Math.round((st.val / top) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {leak && leak.lost > 0 && (
                    <div className="aff-callout" style={{ marginTop: 18 }}>
                      <Warning size={16} weight="fill" />
                      <span>
                        Titik bocor terbesar ada di <b>{leak.from} ke {leak.to}</b>:
                        {' '}{leak.lost} dari {leak.of} sesi tidak lanjut ({Math.round(leak.pct * 100)}%).
                      </span>
                    </div>
                  )}
                  {totals.orderGap > 0 && (
                    <div className="aff-callout is-info" style={{ marginTop: 10 }}>
                      <Info size={16} />
                      <span>
                        Event order page tidak tercatat di {totals.orderGap} sesi yang sudah lanjut ke pilih paket atau checkout.
                        Angka di atas sudah dikoreksi supaya tidak ada tahap yang lebih besar dari tahap sebelumnya.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="aff-card">
                <div className="aff-card-head">
                  <h3 className="aff-card-title">Paket yang dipilih dan dibeli</h3>
                  <p className="aff-card-sub">Satu sesi dihitung sekali per paket.</p>
                </div>
                <div className="aff-card-body">
                  <div className="aff-steps">
                    {plans.map(p => (
                      <div key={p.plan}>
                        <div className="aff-step-top">
                          <span><b style={{ textTransform: 'capitalize' }}>{p.plan}</b></span>
                          <span>{p.selects} dipilih, {p.bought} dibeli{p.selects > 0 ? ` (${fmtPct(p.bought, p.selects)})` : ''}</span>
                        </div>
                        <div className="aff-bar aff-bar-lg">
                          <i style={{ width: `${Math.round((p.selects / maxSelect) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="aff-card" style={{ marginTop: 14 }}>
              <div className="aff-card-head">
                <h3 className="aff-card-title">Kunjungan per hari</h3>
                <p className="aff-card-sub">
                  {days} hari terakhir. Garis = sesi pengunjung, titik hijau = hari ada pembelian.
                </p>
              </div>
              <div className="aff-card-body">
                {hasTrend
                  ? <TrendChart data={trend} />
                  : <div className="aff-empty" style={{ padding: '28px 0' }}>Belum ada kunjungan di periode ini.</div>}
              </div>
            </div>

            {funnelAffiliate === 'all' && affiliates.length > 0 && (
              <div className="aff-card" style={{ marginTop: 14 }}>
                <div className="aff-card-head">
                  <h3 className="aff-card-title">Perbandingan antar partner</h3>
                  <p className="aff-card-sub">Diurutkan dari pembelian terbanyak.</p>
                </div>
                <div className="aff-table-wrap" style={{ marginTop: 12 }}>
                  <table className="aff-table" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th className="aff-th-right">Kunjungan</th>
                        <th className="aff-th-right">Order page</th>
                        <th className="aff-th-right">Pilih paket</th>
                        <th className="aff-th-right">Checkout</th>
                        <th className="aff-th-right">Bayar</th>
                        <th className="aff-th-right">Conv. rate</th>
                        <th className="aff-th-right">Penjualan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perAffiliate.map(({ a, f, revenue }) => (
                        <tr key={a.id}>
                          <td>
                            <div className="aff-name-btn" style={{ cursor: 'default' }}>{a.name}</div>
                            <div className="aff-sub aff-mono">{a.affiliate_code}</div>
                          </td>
                          {[f.landing, f.order, f.plan, f.checkout].map((v, vi) => (
                            <td key={vi} className="aff-td-right">
                              <span className={`aff-fn-val${v === 0 ? ' is-zero' : ''}`}>{v}</span>
                            </td>
                          ))}
                          <td className="aff-td-right">
                            <span className={`aff-fn-val${f.paid === 0 ? ' is-zero' : ' is-win'}`}>{f.paid}</span>
                          </td>
                          <td className="aff-td-right">
                            <span className={`aff-rate${f.paid > 0 ? ' is-win' : ''}`}>{fmtPct(f.paid, f.landing)}</span>
                          </td>
                          <td className="aff-td-right">
                            <span className={`aff-money${revenue > 0 ? ' is-gold' : ''}`}>{revenue > 0 ? fmtRp(revenue) : '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      })()}

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
              <button className="aff-btn aff-btn-sm" onClick={exportReferralsCsv}
                disabled={filteredReferrals.length === 0}>
                <DownloadSimple size={14} />Export CSV
              </button>
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
                          <span className={`badge ${r.plan_type === 'elite' ? 'plan-elite' : r.plan_type === 'pro' ? 'plan-pro': 'plan-basic'}`}>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center'}}>
                            <span className={`badge ${p.plan === 'elite' ? 'plan-elite' : p.plan === 'pro' ? 'plan-pro' : 'plan-basic'}`}>
                              {p.plan.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text2)' }}>
                              {p.count}× · {fmtRp(p.revenue)}
                            </span>
                          </div>
                          <div style={{ height: 7, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: barColor, transition:'width .8s ease' }} />
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
                            <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border2)', color: 'var(--gold2)',fontWeight: 600, fontSize: 13 }}>{aff?.name ?? '—'}</td>
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
                  <input style={{ ...iStyle, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 3, color: 'var(--gold2)',fontSize: 14 }}
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
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: form.is_active ? 'var(--gold2)': 'var(--text3)' }}>
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
