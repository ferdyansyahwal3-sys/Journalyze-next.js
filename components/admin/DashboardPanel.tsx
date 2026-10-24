// components/admin/DashboardPanel.tsx
// Dashboard tracking landing page utama (semua pengunjung: organik, UTM, affiliate).
// Layout terinspirasi dashboard lynk.id, tema dark gold Journalyze.
// Data: landing_events (trafik), transactions (uang), affiliate_referrals (komisi).
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { useAdminStore } from '@/store/useAdminStore';
import './dashboard.css';

// ── Types ──────────────────────────────────────────────────────────────────
interface LandingEvent {
  created_at: string;
  event_type: string;
  session_id: string | null;
  affiliate_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  referrer: string | null;
  plan_type: string | null;
  device: string | null;
}

interface Tx {
  order_id: string;
  paid_at: string | null;
  plan_type: string | null;
  gross_amount: number;
  affiliate_code: string | null;
  is_estimate: boolean;
}

interface Ref {
  commission: number;
  status: string;
}

type Preset = '7' | '14' | '30' | '90' | 'custom';
type Mode = 'all' | 'main' | 'affiliate';
type SourceGroup = 'Affiliate' | 'Web utama' | 'Sosial media' | 'Kampanye lain' | 'Situs lain';

interface SourceRow {
  label: string;
  group: SourceGroup;
  views: number;
  clicks: number;
  viewSessions: Set<string>;
  clickSessions: Set<string>;
}

// ── Konstanta & helper ─────────────────────────────────────────────────────
const SITE_URL = 'https://journalyze.my.id';
const TZ = 'Asia/Jakarta';
const PAGE_SIZE_DB = 1000; // batas default Supabase per request

const QUICK_LINKS = [
  { label: 'TikTok',    url: `${SITE_URL}/?utm_source=tiktok&utm_medium=bio` },
  { label: 'Instagram', url: `${SITE_URL}/?utm_source=instagram&utm_medium=bio` },
  { label: 'WhatsApp',  url: `${SITE_URL}/?utm_source=whatsapp&utm_medium=share` },
  { label: 'YouTube',   url: `${SITE_URL}/?utm_source=youtube&utm_medium=desc` },
];

const MODES: { id: Mode; label: string }[] = [
  { id: 'all',       label: 'Gabungan' },
  { id: 'main',      label: 'LP Utama' },
  { id: 'affiliate', label: 'Affiliate' },
];

const nf = (n: number) => n.toLocaleString('id-ID');
const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** 'YYYY-MM-DD' di zona waktu WIB */
function dayKey(d: Date | string | number): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function fmtDayShort(key: string): string {
  return new Date(key + 'T12:00:00Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

// Kunjungan dari localhost / Vercel = tes developer, tidak dihitung
const DEV_HOST_RE = /(^|\.)(localhost|127\.0\.0\.1|vercel\.com|vercel\.app)$/;

function hostOf(referrer: string | null): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Samakan berbagai ejaan (ig / instagram / l.instagram.com) jadi satu platform */
function platformOf(s: string): string | null {
  if (s === 'ig' || s.includes('instagram')) return 'Instagram';
  if (s === 'tt' || s.includes('tiktok')) return 'TikTok';
  if (s === 'fb' || s.includes('facebook') || s.includes('fb.com') || s.includes('fb.me') || s.includes('messenger')) return 'Facebook';
  if (s === 'yt' || s.includes('youtube') || s.includes('youtu.be')) return 'YouTube';
  if (s === 'wa' || s.includes('whatsapp') || s.includes('wa.me')) return 'WhatsApp';
  return null;
}

function sourceOf(e: LandingEvent): { label: string; group: SourceGroup } {
  // 1) Kode affiliate selalu menang, satu baris per kode
  if (e.affiliate_code) return { label: e.affiliate_code, group: 'Affiliate' };

  // 2) UTM dari link kampanye
  const utm = (e.utm_source ?? '').trim().toLowerCase();
  if (utm) {
    const p = platformOf(utm);
    return p ? { label: p, group: 'Sosial media' } : { label: utm, group: 'Kampanye lain' };
  }

  // 3) Situs asal pengunjung (referrer)
  const host = hostOf(e.referrer);
  if (!host || host.includes('journalyze')) return { label: 'Organik', group: 'Web utama' };
  const p = platformOf(host);
  return p ? { label: p, group: 'Sosial media' } : { label: 'Lainnya', group: 'Situs lain' };
}

async function fetchEvents(fromIso: string, toIso: string): Promise<LandingEvent[]> {
  const all: LandingEvent[] = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await _sbAdmin
      .from('landing_events')
      .select('created_at,event_type,session_id,affiliate_code,utm_source,utm_medium,referrer,plan_type,device')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(p * PAGE_SIZE_DB, p * PAGE_SIZE_DB + PAGE_SIZE_DB - 1);
    if (error) throw error;
    const rows = (data ?? []) as LandingEvent[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE_DB) break;
  }
  return all;
}

async function fetchAllTable<T>(table: string, columns: string): Promise<T[]> {
  const all: T[] = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await _sbAdmin
      .from(table)
      .select(columns)
      .order('created_at', { ascending: false })
      .range(p * PAGE_SIZE_DB, p * PAGE_SIZE_DB + PAGE_SIZE_DB - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE_DB) break;
  }
  return all;
}

// ── Komponen ───────────────────────────────────────────────────────────────
export default function DashboardPanel({ active }: { active: boolean }) {
  const showToast = useAdminStore((s) => s.showToast);

  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState(() => dayKey(Date.now() - 29 * 86400000));
  const [customTo, setCustomTo] = useState(() => dayKey(Date.now()));
  const [mode, setMode] = useState<Mode>('all');
  const [hideMoney, setHideMoney] = useState(false);

  const [events, setEvents] = useState<LandingEvent[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingMoney, setLoadingMoney] = useState(false);
  const [errorEvents, setErrorEvents] = useState('');
  const [errorMoney, setErrorMoney] = useState('');

  const range = useMemo(() => {
    if (preset === 'custom') {
      const asc = customFrom <= customTo;
      return { from: asc ? customFrom : customTo, to: asc ? customTo : customFrom };
    }
    const n = Number(preset);
    return { from: dayKey(Date.now() - (n - 1) * 86400000), to: dayKey(Date.now()) };
  }, [preset, customFrom, customTo]);

  // Trafik: ikut rentang tanggal
  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setErrorEvents('');
    try {
      setEvents(await fetchEvents(`${range.from}T00:00:00+07:00`, `${range.to}T23:59:59.999+07:00`));
    } catch (e) {
      setErrorEvents(errMsg(e));
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [range.from, range.to]);

  // Uang & komisi: lifetime, tidak ikut rentang tanggal
  const loadMoney = useCallback(async () => {
    setLoadingMoney(true);
    setErrorMoney('');
    try {
      const [t, r] = await Promise.all([
        fetchAllTable<Tx>('transactions', 'order_id,paid_at,plan_type,gross_amount,affiliate_code,is_estimate'),
        fetchAllTable<Ref>('affiliate_referrals', 'commission,status'),
      ]);
      setTxs(t);
      setRefs(r);
    } catch (e) {
      setErrorMoney(errMsg(e));
      setTxs([]);
      setRefs([]);
    } finally {
      setLoadingMoney(false);
    }
  }, []);

  useEffect(() => {
    if (active) loadEvents();
  }, [active, loadEvents]);

  useEffect(() => {
    if (active) loadMoney();
  }, [active, loadMoney]);

  const refresh = () => { loadEvents(); loadMoney(); };
  const loading = loadingEvents || loadingMoney;

  // ── Filter Gabungan / LP Utama / Affiliate ──
  const filteredEvents = useMemo(
    () =>
      events
        .filter((e) => !DEV_HOST_RE.test(hostOf(e.referrer))) // buang kunjungan tes (localhost / Vercel)
        .filter((e) => (mode === 'all' ? true : mode === 'main' ? !e.affiliate_code : !!e.affiliate_code)),
    [events, mode]
  );
  const filteredTxs = useMemo(
    () => txs.filter((t) => (mode === 'all' ? true : mode === 'main' ? !t.affiliate_code : !!t.affiliate_code)),
    [txs, mode]
  );

  // ── Kalkulasi trafik ──
  const data = useMemo(() => {
    const days = daysBetween(range.from, range.to);
    const perDay: Record<string, { views: number; clicks: number }> = {};
    days.forEach((d) => { perDay[d] = { views: 0, clicks: 0 }; });

    const viewSessions = new Set<string>();
    const clickSessions = new Set<string>();
    const sources = new Map<string, SourceRow>();
    const plans: Record<string, number> = { basic: 0, pro: 0, elite: 0 };
    const devices: Record<string, number> = { mobile: 0, desktop: 0 };
    let views = 0;
    let clicks = 0;

    filteredEvents.forEach((e) => {
      const key = dayKey(e.created_at);
      const sid = e.session_id || e.created_at;
      const { label, group } = sourceOf(e);
      const sKey = `${group}:${label}`;
      if (!sources.has(sKey)) {
        sources.set(sKey, { label, group, views: 0, clicks: 0, viewSessions: new Set(), clickSessions: new Set() });
      }
      const src = sources.get(sKey)!;

      if (e.event_type === 'landing_view') {
        views++;
        viewSessions.add(sid);
        src.views++;
        src.viewSessions.add(sid);
        if (perDay[key]) perDay[key].views++;
        if (e.device && e.device in devices) devices[e.device]++;
      } else if (e.event_type === 'cta_click') {
        clicks++;
        clickSessions.add(sid);
        src.clicks++;
        src.clickSessions.add(sid);
        if (perDay[key]) perDay[key].clicks++;
        if (e.plan_type && e.plan_type in plans) plans[e.plan_type]++;
      }
    });

    const visitors = viewSessions.size;
    const ctr = visitors ? Math.min(100, (clickSessions.size / visitors) * 100) : 0;
    const sourceList = [...sources.values()]
      .filter((s) => s.views > 0 || s.clicks > 0)
      .sort((a, b) => b.viewSessions.size - a.viewSessions.size || b.clicks - a.clicks);

    const series = days.map((d) => ({ day: d, ...perDay[d] }));
    const peak = Math.max(...series.map((s) => s.views + s.clicks), 5);
    const step = niceStep(peak / 5);

    return { series, views, clicks, visitors, ctr, sourceList, plans, devices, step, top: step * 5 };
  }, [filteredEvents, range.from, range.to]);

  // ── Kalkulasi uang (lifetime) ──
  const money = useMemo(() => {
    const sum = (arr: Tx[]) => arr.reduce((s, t) => s + (Number(t.gross_amount) || 0), 0);
    const affTxs = txs.filter((t) => !!t.affiliate_code);
    return {
      sales: sum(filteredTxs),
      orders: filteredTxs.length,
      estimates: filteredTxs.filter((t) => t.is_estimate).length,
      affOrders: affTxs.length,
      affSales: sum(affTxs),
      commissionPending: refs.filter((r) => r.status === 'pending').reduce((s, r) => s + (Number(r.commission) || 0), 0),
      commissionPaid: refs.filter((r) => r.status === 'paid').reduce((s, r) => s + (Number(r.commission) || 0), 0),
    };
  }, [txs, refs, filteredTxs]);

  const rp = (n: number) => (hideMoney ? 'Rp ••••••' : fmtRp(n));

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Link disalin!', 'success'))
      .catch(() => showToast('Gagal menyalin link.', 'error'));
  };

  const hasData = data.views > 0 || data.clicks > 0;
  const tickEvery = Math.max(1, Math.ceil(data.series.length / 10));
  const planMax = Math.max(...Object.values(data.plans), 1);
  const deviceTotal = data.devices.mobile + data.devices.desktop;

  return (
    <div className="main lp-dash">
      {/* Header */}
      <div className="lp-head">
        <div>
          <div className="lp-eyebrow">Admin Panel</div>
          <h2 className="lp-title">Dashboard <em>Landing Page</em></h2>
          <p className="lp-sub">Pantau pengunjung, klik paket, dan penjualan dari semua sumber trafik.</p>
        </div>
        <button className="refresh-btn" onClick={refresh} disabled={loading}>
          {loading ? <><span className="spinner" />Memuat...</> : '↻ Refresh'}
        </button>
      </div>

      {errorEvents && (
        <div className="lp-error">
          Gagal memuat data trafik: {errorEvents}
          <br />
          Pastikan tabel <code>landing_events</code> sudah dibuat dan route <code>/api/admin/proxy</code> mengizinkannya.
        </div>
      )}
      {errorMoney && (
        <div className="lp-error">
          Gagal memuat data penjualan: {errorMoney}
          <br />
          Pastikan tabel <code>transactions</code> sudah dibuat dan route <code>/api/admin/proxy</code> mengizinkannya.
        </div>
      )}

      {/* Baris atas */}
      <div className="lp-top">
        <div className="lp-card lp-left">
          <div className="lp-card-title">
            Landing Page Utama
            <span className="lp-live">Tracking aktif</span>
          </div>

          <div className="lp-site">
            <div className="lp-site-logo">J<em>z</em></div>
            <div className="lp-site-info">
              <div className="lp-site-name">
                <span style={{ color: 'var(--text)' }}>Journal</span>
                <em style={{ color: 'var(--gold2)' }}>yze</em>
              </div>
              <a className="lp-site-url" href={SITE_URL} target="_blank" rel="noopener noreferrer">{SITE_URL}</a>
            </div>
            <div className="lp-site-actions">
              <a className="lp-chip" href={SITE_URL} target="_blank" rel="noopener noreferrer">Buka</a>
              <button className="lp-chip" onClick={() => copy(SITE_URL)} aria-label="Salin link landing page">
                Salin link
              </button>
            </div>
          </div>

          <div className="lp-quick-label">Salin link kampanye</div>
          <div className="lp-quick">
            {QUICK_LINKS.map((q) => (
              <button key={q.label} className="lp-chip" onClick={() => copy(q.url)}>
                {q.label}
              </button>
            ))}
            <span className="lp-quick-sep" aria-hidden="true" />
            <label className="lp-chip lp-select">
              <span>Tampilkan:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                aria-label="Tampilkan data dari"
              >
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </label>
          </div>
        </div>

        <div className="lp-card lp-hero">
          <div>
            <div className="lp-hero-top">
              <div className="lp-hero-lbl">Total penjualan</div>
              <button
                className="lp-eye"
                onClick={() => setHideMoney((v) => !v)}
                aria-label={hideMoney ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
                aria-pressed={hideMoney}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {hideMoney ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 6.1A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18c1.5 0 2.8-.4 4-.9" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <div className="lp-hero-val money">{loadingMoney && !txs.length ? '…' : rp(money.sales)}</div>
            <div className="lp-hero-sub">
              {nf(money.orders)} order sejak awal
              {money.estimates > 0 && ` · ${nf(money.estimates)} order lama berupa perkiraan`}
            </div>
          </div>
          <div className="lp-hero-foot">
            <div className="lp-hero-row">
              <span>Order via affiliate</span>
              <b>{nf(money.affOrders)} order · {rp(money.affSales)}</b>
            </div>
            <div className="lp-hero-row">
              <span>Komisi belum dibayar</span>
              <b>{rp(money.commissionPending)}</b>
            </div>
            <div className="lp-hero-row">
              <span>Komisi sudah dibayar</span>
              <b>{rp(money.commissionPaid)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Views & Clicks */}
      <div className="chart-box lp-chart-box">
        <div className="lp-chart-head">
          <div className="lp-chart-title">Total Views &amp; Clicks</div>
          <div className="lp-range">
            <select
              className="filter-select"
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
              aria-label="Rentang tanggal"
            >
              <option value="7">7 hari terakhir</option>
              <option value="14">14 hari terakhir</option>
              <option value="30">30 hari terakhir</option>
              <option value="90">90 hari terakhir</option>
              <option value="custom">Pilih tanggal…</option>
            </select>
            {preset === 'custom' && (
              <>
                <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Dari tanggal" />
                <input type="date" value={customTo} min={customFrom} max={dayKey(Date.now())} onChange={(e) => setCustomTo(e.target.value)} aria-label="Sampai tanggal" />
              </>
            )}
          </div>
        </div>

        <div className="lp-legend">
          <div className="lp-legend-item">
            <div className="lp-legend-lbl"><span className="lp-dot views" />Views</div>
            <div className="lp-legend-val">{nf(data.views)}</div>
          </div>
          <div className="lp-legend-item">
            <div className="lp-legend-lbl"><span className="lp-dot clicks" />Clicks</div>
            <div className="lp-legend-val">{nf(data.clicks)}</div>
          </div>
        </div>

        {loadingEvents && !events.length ? (
          <div className="lp-skeleton" style={{ height: 240 }} />
        ) : (
          <>
            <div className="lp-plot">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="lp-grid" style={{ bottom: `${(i / 5) * 100}%` }}>
                  <span>{i * data.step}</span>
                </div>
              ))}
              <div className="lp-bars">
                {data.series.map((s) => (
                  <div className="lp-col" key={s.day}>
                    <div className="lp-pair">
                      <div
                        className="lp-stack"
                        style={{ height: `${((s.views + s.clicks) / data.top) * 100}%`, minHeight: s.views + s.clicks > 0 ? 8 : 0 }}
                      >
                        {s.views > 0 && <div className="lp-stack-views" />}
                        {s.clicks > 0 && (
                          <div
                            className="lp-stack-clicks"
                            style={{ height: `${(s.clicks / (s.views + s.clicks)) * 100}%`, minHeight: 6 }}
                          />
                        )}
                        {s.views + s.clicks > 0 && (
                          <div className="lp-tip">
                            <b>{fmtDayShort(s.day)}</b>
                            <span><i className="sq v" />Views: {nf(s.views)}</span>
                            <span><i className="sq c" />Clicks: {nf(s.clicks)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!hasData && !loadingEvents && (
                <div className="lp-empty-overlay">
                  Belum ada kunjungan pada rentang ini.<br />
                  Data muncul setelah ada pengunjung yang membuka landing page.
                </div>
              )}
            </div>
            <div className="lp-xaxis">
              {data.series.map((s, i) => (
                <div className="lp-xl" key={s.day}>
                  {i % tickEvery === 0 && <span>{fmtDayShort(s.day)}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4 kartu lifetime ala Lynk */}
      <div className="analytics-stats">
        <div className="a-card">
          <div className="a-card-lbl">Total Penjualan (Rp)</div>
          <div className="a-card-val gold">{rp(money.sales)}</div>
          <div className="a-card-sub">Sejak awal · sesuai filter</div>
        </div>
        <div className="a-card">
          <div className="a-card-lbl">Total Order</div>
          <div className="a-card-val">{nf(money.orders)}</div>
          <div className="a-card-sub">Pembayaran berhasil · sesuai filter</div>
        </div>
        <div className="a-card">
          <div className="a-card-lbl">Order via Affiliate</div>
          <div className="a-card-val green">{nf(money.affOrders)}</div>
          <div className="a-card-sub">{rp(money.affSales)} penjualan · semua order</div>
        </div>
        <div className="a-card">
          <div className="a-card-lbl">Komisi Affiliate Pending</div>
          <div className="a-card-val blue">{rp(money.commissionPending)}</div>
          <div className="a-card-sub">{rp(money.commissionPaid)} sudah dibayar</div>
        </div>
      </div>

      {/* Sumber trafik + paket & device */}
      <div className="analytics-grid">
        <div className="chart-box">
          <div className="chart-box-title">Sumber Trafik</div>
          {data.sourceList.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0', fontSize: 12 }}>Belum ada data</div>
          ) : (
            <>
            <div className="table-wrap lp-src-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Sumber</th>
                    <th>Pengunjung</th>
                    <th>Klik</th>
                    <th>Rasio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourceList.map((s) => {
                    const rate = s.viewSessions.size ? Math.min(100, (s.clickSessions.size / s.viewSessions.size) * 100) : 0;
                    return (
                      <tr key={`${s.group}:${s.label}`}>
                        <td data-label="Sumber">
                          <div>
                            <div className="lp-src-name">{s.label}</div>
                            <div className="lp-src-kind">{s.group}</div>
                          </div>
                        </td>
                        <td data-label="Pengunjung"><span className="lp-num">{nf(s.viewSessions.size)}</span></td>
                        <td data-label="Klik"><span className={`lp-num ${s.clicks ? 'green' : 'muted'}`}>{nf(s.clicks)}</span></td>
                        <td data-label="Rasio"><span className={`lp-num ${rate ? '' : 'muted'}`}>{rate.toFixed(1)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.sourceList.length > 5 && (
              <div className="lp-src-more">
                5 dari {nf(data.sourceList.length)} sumber tampil · scroll tabel untuk melihat sisanya
              </div>
            )}
            </>
          )}
        </div>

        <div className="chart-box">
          <div className="chart-box-title">Paket yang Diklik</div>
          <div className="lp-hbars">
            {(['basic', 'pro', 'elite'] as const).map((p) => (
              <div key={p}>
                <div className="lp-hbar-row">
                  <span className={`badge plan-${p}`}>{p.toUpperCase()}</span>
                  <span className="lp-hbar-meta">{nf(data.plans[p])} klik</span>
                </div>
                <div className="lp-hbar-track">
                  <div className={`lp-hbar-fill ${p === 'pro' ? 'gold' : p === 'basic' ? 'blue' : 'green'}`}
                       style={{ width: `${(data.plans[p] / planMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="lp-subhead">Perangkat</div>
          <div className="lp-hbars">
            {(['mobile', 'desktop'] as const).map((d) => {
              const pct = deviceTotal ? Math.round((data.devices[d] / deviceTotal) * 100) : 0;
              return (
                <div key={d}>
                  <div className="lp-hbar-row">
                    <span className="lp-hbar-meta">{d === 'mobile' ? 'HP' : 'Desktop'}</span>
                    <span className="lp-hbar-meta">{nf(data.devices[d])} · {pct}%</span>
                  </div>
                  <div className="lp-hbar-track">
                    <div className="lp-hbar-fill gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
