// components/admin/MetaAnalyticsPanel.tsx
// Sub-halaman "Analitik Meta" di tab Pixel — murni data dari Meta Marketing API.
// Angka diambil dari /api/pixel/insights (server); token Meta TIDAK ada di browser.
// Tampilan selalu muncul penuh: bila belum ada data, angka 0 / "—" dan grafik kosong.
// Filter tanggal memakai DateRangePicker yang sama dengan Dashboard.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { _sb } from '@/lib/supabaseClient';
import DateRangePicker, { currentMonthRange } from './DateRangePicker';
import type { DateRange } from './DateRangePicker';
import './dashboard.css';
import './meta-analytics.css';

// ── Types (cermin dari respons /api/pixel/insights) ─────────────────────────
interface Metrics {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number | null;
  linkClicks: number;
  ctr: number;
  cpc: number | null;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
  costPerPurchase: number | null;
  roas: number | null;
}
interface NamedRow extends Metrics { id: string; name: string }
interface LabelRow extends Metrics { label: string }
interface DailyRow extends Metrics { date: string }

interface Breakdowns {
  platform: LabelRow[];
  placement: LabelRow[];
  age: LabelRow[];
  gender: LabelRow[];
  device: LabelRow[];
}
type RowLevel = 'campaign' | 'adset' | 'ad';
interface Overview {
  configured: true;
  view: 'overview';
  range: { from: string; to: string };
  fetchedAt: number;
  cached: boolean;
  rowLevel: RowLevel;
  totals: Metrics;
  daily: DailyRow[];
  rows: NamedRow[];
  breakdowns: Breakdowns;
  breakdownError?: string;
}
interface ChildrenResp { configured: true; view: 'children'; rows: NamedRow[] }
interface NotConfigured { configured: false; missing: string[]; invalid: string[] }
interface Sel { campaign: string; adset: string; ad: string }

type ChartMetric = 'spend' | 'impressions' | 'linkClicks' | 'purchases';
type KidsState = { status: 'loading' | 'ok' | 'error'; rows: NamedRow[]; error?: string };

// ── Helper ──────────────────────────────────────────────────────────────────
const TZ = 'Asia/Jakarta';
const MAX_RANGE_DAYS = 93;
const NO_SEL: Sel = { campaign: '', adset: '', ad: '' };

const EMPTY: Metrics = {
  spend: 0, impressions: 0, reach: 0, frequency: 0, cpm: null, linkClicks: 0, ctr: 0, cpc: null,
  landingPageViews: 0, addToCart: 0, initiateCheckout: 0, purchases: 0, purchaseValue: 0,
  costPerPurchase: null, roas: null,
};
const EMPTY_BREAKDOWNS: Breakdowns = { platform: [], placement: [], age: [], gender: [], device: [] };

const nf = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const nfInt = (n: number) => Math.round(n).toLocaleString('id-ID');
const pct = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
const dash = (n: number | null) => (n === null ? '—' : nf(n));
const roasText = (n: number | null) => (n === null ? '—' : `${nf(n)}×`);

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

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

const LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network',
  messenger: 'Messenger', threads: 'Threads', unknown: 'Tidak diketahui',
  male: 'Pria', female: 'Wanita',
  mobile_app: 'Aplikasi seluler', mobile_web: 'Web seluler', desktop: 'Desktop',
};
function prettyLabel(s: string): string {
  return s
    .split(' · ')
    .map((p) => LABELS[p.toLowerCase()] ?? p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' · ');
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await _sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi login admin tidak ditemukan. Muat ulang halaman.');
  return { Authorization: `Bearer ${token}` };
}

const METRIC_LABEL: Record<ChartMetric, string> = {
  spend: 'Biaya iklan',
  impressions: 'Impressions',
  linkClicks: 'Klik link',
  purchases: 'Pembelian',
};
const ROW_TITLE: Record<RowLevel, string> = { campaign: 'Kampanye', adset: 'Ad set', ad: 'Iklan' };

// ── Komponen ────────────────────────────────────────────────────────────────
export default function MetaAnalyticsPanel({ active }: { active: boolean }) {
  const [range, setRange] = useState<DateRange>(() => currentMonthRange()); // default sama dengan Dashboard
  const [metric, setMetric] = useState<ChartMetric>('spend');

  const [sel, setSel] = useState<Sel>(NO_SEL);
  const [campaignOpts, setCampaignOpts] = useState<NamedRow[]>([]);
  const [adsetOpts, setAdsetOpts] = useState<NamedRow[]>([]);
  const [adOpts, setAdOpts] = useState<NamedRow[]>([]);

  const [data, setData] = useState<Overview | null>(null);
  const [setup, setSetup] = useState<NotConfigured | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [kids, setKids] = useState<Record<string, KidsState>>({});
  const reqId = useRef(0);

  // Rentang efektif: tanggal akhir dipotong sampai hari ini (Meta tidak punya data masa depan)
  const eff = useMemo(() => {
    const today = dayKey(Date.now());
    return { from: range.from, to: range.to > today ? today : range.to };
  }, [range]);
  const future = eff.from > eff.to;
  const rangeDays = useMemo(() => (future ? 0 : daysBetween(eff.from, eff.to).length), [eff, future]);
  const tooLong = rangeDays > MAX_RANGE_DAYS;

  const load = useCallback(async () => {
    if (tooLong) return;
    if (future) {
      setError('Seluruh rentang tanggal ada di masa depan, belum ada data.');
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    try {
      const headers = await authHeader();
      const params = new URLSearchParams({ from: eff.from, to: eff.to });
      if (sel.campaign) params.set('campaign', sel.campaign);
      if (sel.adset) params.set('adset', sel.adset);
      if (sel.ad) params.set('ad', sel.ad);

      const res = await fetch(`/api/pixel/insights?${params.toString()}`, { headers, cache: 'no-store' });
      const json = (await res.json()) as Record<string, unknown>;
      if (id !== reqId.current) return; // ada permintaan yang lebih baru

      if (json.configured === false) {
        setSetup(json as unknown as NotConfigured);
        setData(null);
      } else if (!res.ok || typeof json.error === 'string') {
        throw new Error(typeof json.error === 'string' ? json.error : `Gagal memuat (HTTP ${res.status})`);
      } else {
        const ov = json as unknown as Overview;
        setSetup(null);
        setData(ov);
        // Isi pilihan filter sesuai tingkat baris yang baru dimuat
        if (ov.rowLevel === 'campaign') setCampaignOpts(ov.rows);
        else if (ov.rowLevel === 'adset') setAdsetOpts(ov.rows);
        else if (!sel.ad) setAdOpts(ov.rows);
      }
      setExpanded({});
      setKids({});
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [eff, sel, tooLong, future]);

  useEffect(() => {
    if (!active) return;
    load();
  }, [active, load]);

  const loadKids = useCallback(
    async (key: string, parentId: string, level: 'adset' | 'ad') => {
      setKids((k) => ({ ...k, [key]: { status: 'loading', rows: [] } }));
      try {
        const headers = await authHeader();
        const res = await fetch(
          `/api/pixel/insights?view=children&parent=${parentId}&level=${level}&from=${eff.from}&to=${eff.to}`,
          { headers, cache: 'no-store' }
        );
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok || typeof json.error === 'string') {
          throw new Error(typeof json.error === 'string' ? json.error : `Gagal memuat (HTTP ${res.status})`);
        }
        setKids((k) => ({ ...k, [key]: { status: 'ok', rows: (json as unknown as ChildrenResp).rows } }));
      } catch (e) {
        setKids((k) => ({ ...k, [key]: { status: 'error', rows: [], error: errMsg(e) } }));
      }
    },
    [eff]
  );

  const toggleRow = (level: RowLevel, row: NamedRow) => {
    if (level === 'ad') return;
    const key = `${level}:${row.id}`;
    const willOpen = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: willOpen }));
    if (willOpen && !kids[key]) loadKids(key, row.id, level === 'campaign' ? 'adset' : 'ad');
  };

  // ── Handler filter ──
  const resetAll = () => {
    setSel(NO_SEL);
    setCampaignOpts([]);
    setAdsetOpts([]);
    setAdOpts([]);
  };
  const onRangeChange = (r: DateRange) => {
    setRange(r);
    resetAll(); // pilihan lama mungkin tidak ada di rentang baru
  };
  const onCampaign = (id: string) => {
    setSel({ campaign: id, adset: '', ad: '' });
    setAdsetOpts([]);
    setAdOpts([]);
  };
  const onAdset = (id: string) => {
    setSel((s) => ({ ...s, adset: id, ad: '' }));
    setAdOpts([]);
  };
  const onAd = (id: string) => setSel((s) => ({ ...s, ad: id }));

  const nameOf = (list: NamedRow[], id: string) => list.find((o) => o.id === id)?.name ?? id;

  // ── Turunan data (aman saat data masih kosong) ──
  const t = data?.totals ?? EMPTY;
  const bd = data?.breakdowns ?? EMPTY_BREAKDOWNS;
  const rows = data?.rows ?? [];
  const rowLevel: RowLevel = data?.rowLevel ?? 'campaign';
  const pickedDays = daysBetween(range.from, range.to).length;
  const rangeLabel = `${fmtDayShort(range.from)} – ${fmtDayShort(range.to)} · ${pickedDays} hari`;
  const clamped = !future && eff.to !== range.to;

  const series = useMemo(() => {
    const map = new Map<string, DailyRow>();
    (data?.daily ?? []).forEach((d) => map.set(d.date, d));
    return (future ? [] : daysBetween(eff.from, eff.to)).map((day) => ({
      day,
      value: map.get(day)?.[metric] ?? 0,
    }));
  }, [data, metric, eff, future]);

  const maxVal = useMemo(() => Math.max(0, ...series.map((s) => s.value)), [series]);
  const seriesTotal = useMemo(() => series.reduce((a, s) => a + s.value, 0), [series]);
  const fmtMetric = (n: number) => (metric === 'spend' ? nf(n) : nfInt(n));
  const tickEvery = series.length <= 31 ? 1 : Math.ceil(series.length / 24);

  const funnel = [
    { label: 'Klik link', value: t.linkClicks, color: 'gold' },
    { label: 'Landing page view', value: t.landingPageViews, color: 'blue' },
    { label: 'Tambah ke keranjang', value: t.addToCart, color: 'green' },
    { label: 'Mulai checkout', value: t.initiateCheckout, color: 'blue' },
    { label: 'Pembelian', value: t.purchases, color: 'gold' },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const scopeParts: string[] = [];
  if (sel.campaign) scopeParts.push(`Campaign: ${nameOf(campaignOpts, sel.campaign)}`);
  if (sel.adset) scopeParts.push(`Ad set: ${nameOf(adsetOpts, sel.adset)}`);
  if (sel.ad) scopeParts.push(`Iklan: ${nameOf(adOpts, sel.ad)}`);

  // ── Baris tabel (rekursif: kampanye → adset → iklan) ──
  const renderRow = (row: NamedRow, level: RowLevel, depth: number): ReactNode[] => {
    const key = `${level}:${row.id}`;
    const canOpen = level !== 'ad';
    const open = !!expanded[key];
    const out: ReactNode[] = [];

    out.push(
      <tr
        key={key}
        className={`ma-tr depth-${depth}${canOpen ? ' clickable' : ''}`}
        onClick={() => toggleRow(level, row)}
        onKeyDown={(e) => { if (canOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(level, row); } }}
        tabIndex={canOpen ? 0 : undefined}
        aria-expanded={canOpen ? open : undefined}
      >
        <td className="ma-name" style={{ paddingLeft: 12 + depth * 22 }}>
          {canOpen ? <span className="ma-caret">{open ? '▾' : '▸'}</span> : <span className="ma-caret" />}
          {row.name}
          <span className="ma-kind">{ROW_TITLE[level]}</span>
        </td>
        <MetricCells m={row} />
      </tr>
    );

    if (open) {
      const st = kids[key];
      const colSpan = 13;
      const childLevel: RowLevel = level === 'campaign' ? 'adset' : 'ad';
      const pad = 34 + depth * 22;
      if (!st || st.status === 'loading') {
        out.push(<tr key={`${key}:l`}><td className="ma-sub-msg" colSpan={colSpan} style={{ paddingLeft: pad }}>Memuat…</td></tr>);
      } else if (st.status === 'error') {
        out.push(<tr key={`${key}:e`}><td className="ma-sub-msg err" colSpan={colSpan} style={{ paddingLeft: pad }}>Gagal memuat: {st.error}</td></tr>);
      } else if (st.rows.length === 0) {
        out.push(<tr key={`${key}:0`}><td className="ma-sub-msg" colSpan={colSpan} style={{ paddingLeft: pad }}>Tidak ada data pada rentang ini.</td></tr>);
      } else {
        st.rows.forEach((c) => out.push(...renderRow(c, childLevel, depth + 1)));
      }
    }
    return out;
  };

  // ── Render ──
  return (
    <div className={`main lp-dash ma-wrap${loading ? ' ma-loading' : ''}`}>
      {/* Header */}
      <div className="lp-head">
        <div>
          <div className="lp-eyebrow">Meta Marketing API</div>
          <h2 className="lp-title">Analitik <em>Meta Ads</em></h2>
          <p className="lp-sub">
            Angka asli dari Meta. Mata uang mengikuti pengaturan akun iklan Meta kamu.
          </p>
        </div>
        <div className="lp-range">
          <DateRangePicker from={range.from} to={range.to} onChange={onRangeChange} />
          <button className="refresh-btn" onClick={load} disabled={loading || tooLong}>
            {loading ? <><span className="spinner" />Memuat...</> : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Filter campaign → ad set → iklan (menyala setelah data muncul) */}
      <div className="ma-filters">
        <FilterSelect
          label="Campaign"
          allLabel="Semua campaign"
          value={sel.campaign}
          options={campaignOpts}
          disabled={!data || campaignOpts.length === 0}
          onChange={onCampaign}
        />
        <FilterSelect
          label="Ad set"
          allLabel="Semua ad set"
          value={sel.adset}
          options={adsetOpts}
          disabled={!sel.campaign || adsetOpts.length === 0}
          onChange={onAdset}
        />
        <FilterSelect
          label="Iklan"
          allLabel="Semua iklan"
          value={sel.ad}
          options={adOpts}
          disabled={!sel.adset || adOpts.length === 0}
          onChange={onAd}
        />
        {sel.campaign && (
          <button className="lp-chip" onClick={resetAll}>Reset filter</button>
        )}
      </div>
      {scopeParts.length > 0 && (
        <div className="ma-scope">Menampilkan data untuk <b>{scopeParts.join(' › ')}</b></div>
      )}

      {tooLong && <div className="lp-error">Rentang maksimal {MAX_RANGE_DAYS} hari. Persempit tanggalnya.</div>}
      {error && <div className="lp-error">{error}</div>}
      {data?.breakdownError && (
        <div className="lp-error">Rincian (platform, umur, dll.) gagal dimuat: {data.breakdownError}</div>
      )}

      {/* Panduan setup — bisa dibuka/tutup, hilang sendiri setelah Meta terhubung */}
      {setup && (
        <div className="lp-card ma-setup">
          <div className="ma-setup-head">
            <div className="lp-card-title" style={{ marginBottom: 0 }}>
              Hubungkan akun iklan Meta
              <span className="ma-badge-off">Belum terhubung</span>
            </div>
            <button className="lp-chip" onClick={() => setGuideOpen((v) => !v)} aria-expanded={guideOpen}>
              {guideOpen ? 'Tutup panduan' : 'Buka panduan'}
            </button>
          </div>
          {guideOpen && (
            <>
              <p className="ma-note">
                {setup.invalid.length > 0
                  ? <>Format <code>META_AD_ACCOUNT_ID</code> belum benar. Harus berbentuk <code>act_</code> diikuti angka.</>
                  : <>Variabel yang belum diisi: {setup.missing.map((m) => <code key={m}>{m}</code>)}</>}
              </p>
              <ol className="ma-steps">
                <li>Buka <b>Meta Business Settings</b> lalu <b>Users → System Users</b>, buat System User baru.</li>
                <li>Beri System User akses ke <b>akun iklan</b> kamu (cukup izin membaca performa) dan ke <b>App</b> developer.</li>
                <li>Klik <b>Generate token</b>, pilih App, centang izin <code>ads_read</code> saja, lalu salin token (hanya tampil sekali).</li>
                <li>Salin <b>ID akun iklan</b> (format <code>act_1234567890</code>).</li>
                <li>Isi di <b>Vercel → Project → Settings → Environment Variables</b>: <code>META_ADS_ACCESS_TOKEN</code> dan <code>META_AD_ACCOUNT_ID</code>. Isi juga di <code>.env.local</code> untuk lokal.</li>
                <li>Redeploy di Vercel, lalu muat ulang halaman ini.</li>
              </ol>
              <p className="ma-note">
                Jangan tempel token ke chat, Supabase, atau repo. Token hanya dibaca oleh server.
                Nama menu di Meta kadang berubah; kalau beda, ikuti padanannya.
              </p>
            </>
          )}
        </div>
      )}

      {/* Baris atas: ringkasan + hero biaya */}
      <div className="lp-top">
        <div className="lp-card lp-left">
          <div className="lp-card-title">
            Ringkasan performa
            {data ? <span className="lp-live">Terhubung</span> : <span className="ma-badge-off">Belum ada data</span>}
          </div>
          <div className="ma-stats">
            <Stat label="Impressions" value={nfInt(t.impressions)} />
            <Stat label="Reach" value={nfInt(t.reach)} />
            <Stat label="Frequency" value={nf(t.frequency)} />
            <Stat label="CPM" value={dash(t.cpm)} />
            <Stat label="Klik link" value={nfInt(t.linkClicks)} />
            <Stat label="CTR (klik link)" value={pct(t.ctr)} />
            <Stat label="CPC (klik link)" value={dash(t.cpc)} />
            <Stat label="Landing page view" value={nfInt(t.landingPageViews)} />
          </div>
        </div>

        <div className="lp-card lp-hero">
          <div>
            <div className="lp-hero-lbl">Biaya iklan</div>
            <div className="lp-hero-val money">{nf(t.spend)}</div>
            <div className="lp-hero-sub">{rangeLabel}</div>
            {clamped && (
              <div className="lp-hero-sub ma-hero-note">Data tersedia sampai {fmtDayShort(eff.to)} (hari ini)</div>
            )}
          </div>
          <div>
            <div className="lp-hero-row"><span>Pembelian</span><b>{nfInt(t.purchases)}</b></div>
            <div className="lp-hero-row"><span>Nilai pembelian</span><b>{nf(t.purchaseValue)}</b></div>
            <div className="lp-hero-row"><span>Biaya / pembelian</span><b>{dash(t.costPerPurchase)}</b></div>
            <div className="lp-hero-row"><span>ROAS</span><b>{roasText(t.roas)}</b></div>
          </div>
        </div>
      </div>

      {/* Grafik harian */}
      <div className="lp-card lp-chart-box">
        <div className="lp-chart-head">
          <div className="lp-chart-title">Performa harian</div>
          <div className="lp-seg">
            {(Object.keys(METRIC_LABEL) as ChartMetric[]).map((m) => (
              <button
                key={m}
                className={`lp-seg-btn${metric === m ? ' active' : ''}`}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="lp-legend">
          <div className="lp-legend-item">
            <div className="lp-legend-lbl"><span className="lp-dot views" />{METRIC_LABEL[metric]}</div>
            <div className="lp-legend-val">{fmtMetric(seriesTotal)}</div>
          </div>
        </div>

        <div className="ma-plot-wrap">
          <div className="ma-plot">
            {[1, 0.75, 0.5, 0.25, 0].map((f) => (
              <div key={f} className="ma-grid" style={{ bottom: `${f * 100}%` }}>
                <span>{maxVal > 0 ? fmtMetric(maxVal * f) : f === 0 ? '0' : ''}</span>
              </div>
            ))}
            <div className="ma-bars">
              {series.map((s) => (
                <div className="ma-col" key={s.day}>
                  <div
                    className="ma-bar"
                    style={{ height: `${s.value > 0 && maxVal > 0 ? Math.max(2, (s.value / maxVal) * 100) : 0}%` }}
                  />
                  <div className="ma-tip">
                    <span>{fmtDayShort(s.day)}</span>
                    <b>{METRIC_LABEL[metric]}: {fmtMetric(s.value)}</b>
                  </div>
                </div>
              ))}
            </div>
            {maxVal === 0 && <div className="ma-empty-overlay">Belum ada data {METRIC_LABEL[metric].toLowerCase()} pada rentang ini.</div>}
          </div>
          <div className="ma-xaxis">
            {series.map((s, i) => (
              <div className="ma-xl" key={s.day}>
                {i % tickEvery === 0 && (
                  <span>{i === 0 || s.day.endsWith('-01') ? fmtDayShort(s.day) : String(Number(s.day.slice(8, 10)))}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Corong hasil + rincian */}
      <div className="ma-two">
        <div className="lp-card">
          <div className="lp-card-title">Corong hasil</div>
          <div className="lp-hbars">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="lp-hbar-row">
                  <span className="lp-src-name">{f.label}</span>
                  <span className="lp-hbar-meta">{nfInt(f.value)}</span>
                </div>
                <div className="lp-hbar-track">
                  <div className={`lp-hbar-fill ${f.color}`} style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="ma-note">
            Landing page view dihitung saat halaman selesai dimuat, jadi bisa lebih kecil dari klik link.
            Tambah ke keranjang, checkout, dan pembelian muncul bila Pixel/CAPI mengirim event tersebut.
          </p>
        </div>

        <BreakdownCard title="Platform" rows={bd.platform} />
      </div>

      <div className="ma-two">
        <BreakdownCard title="Penempatan" rows={bd.placement} />
        <BreakdownCard title="Perangkat" rows={bd.device} />
      </div>

      <div className="ma-two">
        <BreakdownCard title="Umur" rows={bd.age} sortByLabel />
        <BreakdownCard title="Gender" rows={bd.gender} />
      </div>

      {/* Tabel dengan drill-down */}
      <div className="lp-card ma-table-card">
        <div className="lp-card-title">{ROW_TITLE[rowLevel]}</div>
        <p className="ma-note" style={{ marginTop: 0 }}>
          {rowLevel === 'campaign' && 'Klik baris kampanye untuk melihat ad set, lalu klik ad set untuk melihat iklannya.'}
          {rowLevel === 'adset' && 'Klik baris ad set untuk melihat iklannya.'}
          {rowLevel === 'ad' && 'Daftar iklan sesuai filter yang dipilih.'}
        </p>
        <div className="ma-table-wrap">
          <table className="ma-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Biaya</th>
                <th>Impressions</th>
                <th>Reach</th>
                <th>Frequency</th>
                <th>CPM</th>
                <th>Klik link</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>LP view</th>
                <th>Pembelian</th>
                <th>Biaya/pembelian</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="ma-sub-msg" colSpan={13} style={{ textAlign: 'center', padding: '28px 12px' }}>Belum ada data pada rentang ini.</td></tr>
              ) : (
                rows.flatMap((c) => renderRow(c, rowLevel, 0))
              )}
            </tbody>
            <tfoot>
              <tr className="ma-total">
                <td className="ma-name">Total</td>
                <MetricCells m={t} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {data && (
        <div className="ma-foot">
          Diperbarui {new Date(data.fetchedAt).toLocaleTimeString('id-ID', { timeZone: TZ })} WIB
          {data.cached ? ' · dari cache server (maks. 5 menit)' : ''}
        </div>
      )}
    </div>
  );
}

// ── Sub-komponen ────────────────────────────────────────────────────────────
function FilterSelect({
  label, allLabel, value, options, disabled, onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: NamedRow[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className={`lp-chip lp-select ma-filter${disabled ? ' disabled' : ''}`}>
      <span>{label}:</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        <option value="">{allLabel}{options.length > 0 ? ` (${options.length})` : ''}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ma-stat">
      <div className="ma-stat-lbl">{label}</div>
      <div className="ma-stat-val">{value}</div>
    </div>
  );
}

function MetricCells({ m }: { m: Metrics }) {
  return (
    <>
      <td>{nf(m.spend)}</td>
      <td>{nfInt(m.impressions)}</td>
      <td>{nfInt(m.reach)}</td>
      <td>{nf(m.frequency)}</td>
      <td>{dash(m.cpm)}</td>
      <td>{nfInt(m.linkClicks)}</td>
      <td>{pct(m.ctr)}</td>
      <td>{dash(m.cpc)}</td>
      <td>{nfInt(m.landingPageViews)}</td>
      <td>{nfInt(m.purchases)}</td>
      <td>{dash(m.costPerPurchase)}</td>
      <td>{roasText(m.roas)}</td>
    </>
  );
}

const BAR_COLORS = ['gold', 'blue', 'green'];

function BreakdownCard({ title, rows, sortByLabel }: { title: string; rows: LabelRow[]; sortByLabel?: boolean }) {
  const list = (sortByLabel ? [...rows].sort((a, b) => a.label.localeCompare(b.label)) : rows).slice(0, 10);
  const totalSpend = rows.reduce((a, r) => a + r.spend, 0);
  return (
    <div className="lp-card">
      <div className="lp-card-title">{title}</div>
      {list.length === 0 || totalSpend === 0 ? (
        <div className="ma-empty">Belum ada data.</div>
      ) : (
        <div className="lp-hbars">
          {list.map((r, i) => {
            const share = (r.spend / totalSpend) * 100;
            return (
              <div key={r.label}>
                <div className="lp-hbar-row">
                  <span className="lp-src-name">{prettyLabel(r.label)}</span>
                  <span className="lp-hbar-meta">{nf(r.spend)} · {pct(share)}</span>
                </div>
                <div className="lp-hbar-track">
                  <div className={`lp-hbar-fill ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${share}%` }} />
                </div>
                <div className="ma-bd-sub">
                  {nfInt(r.impressions)} impressions · {nfInt(r.linkClicks)} klik link · {nfInt(r.purchases)} pembelian
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
