// lib/econ.ts
// Helper kalender ekonomi — MURNI (tanpa import server-only), dipakai oleh:
//   • server : /api/econ-sync, /api/econ-calendar, /api/econ-history
//   • client : components/journal/PageNews.tsx (compareBetter)
//
// Catatan penting:
//   Feed ForexFactory (nfs.faireconomy.media) HANYA punya: title, country, date,
//   impact, forecast, previous. Tidak ada `actual`, tidak ada history.
//   Karena itu Journalyze menyimpan snapshot sendiri di tabel `econ_events`.

// ── Konstanta & tipe ──────────────────────────────────────────────────────────
export const CALENDAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] as const;

export type EconImpact = 'high' | 'medium' | 'low' | 'holiday';
export type Verdict = 'good' | 'bad' | 'neutral';

export interface EconRow {
  id: string;
  currency: string;
  title: string;
  title_key: string;
  impact: EconImpact;
  release_at: string; // ISO UTC
  forecast: string | null;
  previous: string | null;
}

export interface FFRaw {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
}

export interface HistoryRow {
  date: string;
  actual: string;
  forecast: string;
  previous: string;
}

export interface SeriesRow {
  release_at: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

// ── Normalisasi feed ──────────────────────────────────────────────────────────
const IMPACT_MAP: Record<string, EconImpact> = {
  high: 'high', medium: 'medium', low: 'low', holiday: 'holiday',
};

export function mapImpact(raw?: string): EconImpact | null {
  return IMPACT_MAP[(raw || '').trim().toLowerCase()] ?? null;
}

export function normalizeTitle(title: string): string {
  return (title || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function makeEventId(currency: string, title: string, releaseIso: string): string {
  return `${currency}|${normalizeTitle(title)}|${releaseIso}`;
}

/** Ubah JSON feed ForexFactory → baris siap upsert. Baris tidak valid dibuang. */
export function feedToRows(raw: unknown): EconRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: EconRow[] = [];
  const seen = new Set<string>();
  for (const e of raw as FFRaw[]) {
    const title = (e?.title || '').trim();
    const currency = (e?.country || '').trim().toUpperCase();
    const impact = mapImpact(e?.impact);
    const t = new Date(e?.date || '');
    if (!title || !currency || !impact || Number.isNaN(t.getTime())) continue;
    const release_at = t.toISOString();
    const id = makeEventId(currency, title, release_at);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      currency,
      title,
      title_key: normalizeTitle(title),
      impact,
      release_at,
      forecast: (e.forecast || '').trim() || null,
      previous: (e.previous || '').trim() || null,
    });
  }
  return rows;
}

// ── Parsing nilai ("3.7%", "175K", "-1.2B", "—") ──────────────────────────────
const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

export function parseEconValue(raw?: string | null): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/,/g, '').replace(/\*/g, '').trim();
  if (!s || s === '—' || s === '-') return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*([kmbt])?(?![a-z])/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const scale = m[2] ? SCALE[m[2].toLowerCase()] : 1;
  return n * scale;
}

/** Cegah verdict salah kalau skala dua angka beda jauh (mis. 175 vs 175K). */
export function scalesPlausible(a: number, f: number): boolean {
  return Math.abs(a) <= 100 * Math.max(Math.abs(f), 1) && Math.abs(f) <= 100 * Math.max(Math.abs(a), 1);
}

// Konvensi ForexFactory: "Actual > Forecast = bagus untuk mata uang".
// Kecuali indikator di bawah, di mana angka LEBIH RENDAH yang bagus.
const LOWER_IS_BETTER = /unemploy|jobless|claimant/i;

/**
 * Bandingkan actual vs forecast dengan memperhitungkan indikator inverse
 * (Unemployment Rate, Jobless Claims, dst). Return null kalau tidak bisa
 * dibandingkan dengan yakin.
 */
export function compareBetter(
  title: string | undefined,
  actual?: string | null,
  forecast?: string | null,
): Verdict | null {
  const a = parseEconValue(actual);
  const f = parseEconValue(forecast);
  if (a === null || f === null) return null;
  if (!scalesPlausible(a, f)) return null;
  if (Math.abs(a - f) < 1e-9 * Math.max(1, Math.abs(f))) return 'neutral';
  const higherIsBetter = !LOWER_IS_BETTER.test(title || '');
  return (a > f) === higherIsBetter ? 'good' : 'bad';
}

/** actual − forecast (angka mentah), null kalau tidak bisa dihitung. */
export function surpriseOf(actual?: string | null, forecast?: string | null): number | null {
  const a = parseEconValue(actual);
  const f = parseEconValue(forecast);
  if (a === null || f === null || !scalesPlausible(a, f)) return null;
  return a - f;
}

// ── Waktu ─────────────────────────────────────────────────────────────────────
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function fmtDateWib(iso: string): string {
  const w = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${w.getUTCDate()} ${MONTHS_ID[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

/** Rentang minggu (Senin 00:00 WIB → +7 hari) — logika sama dengan getWeekStart() di PageNews. */
export function weekRangeWib(nowMs: number = Date.now()): { fromIso: string; toIso: string } {
  const n = new Date(nowMs + 7 * 3600 * 1000);
  const dw = n.getUTCDay();
  const df = dw === 0 ? 1 : 1 - dw;
  const monUtcMidnight = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + df);
  const fromMs = monUtcMidnight - 7 * 3600 * 1000;
  return { fromIso: new Date(fromMs).toISOString(), toIso: new Date(fromMs + 7 * 86400 * 1000).toISOString() };
}

// ── History per seri event ────────────────────────────────────────────────────
/**
 * Bangun history rilis sebelumnya untuk satu seri (currency + title_key).
 * Kalau `actual` belum tersimpan, dipakai `previous` dari rilis berikutnya
 * (nilai yang sudah direvisi) dan ditandai tanda bintang "*".
 */
export function buildHistory(series: SeriesRow[], beforeIso: string, max = 6): HistoryRow[] {
  const asc = [...series].sort((a, b) => (a.release_at < b.release_at ? -1 : a.release_at > b.release_at ? 1 : 0));
  const out: HistoryRow[] = [];
  for (let i = 0; i < asc.length; i++) {
    const r = asc[i];
    if (r.release_at >= beforeIso) continue;
    const next = asc[i + 1];
    let actual = r.actual;
    if (!actual && next?.previous) actual = next.previous + '*';
    out.push({
      date: fmtDateWib(r.release_at),
      actual: actual || '—',
      forecast: r.forecast || '—',
      previous: r.previous || '—',
    });
  }
  return out.slice(-max).reverse();
}

// ── Matching actual dari provider eksternal (mis. Finnhub) ────────────────────
export interface ProviderEvent {
  event?: string;
  country?: string;
  time?: string;
  actual?: number | null;
  estimate?: number | null;
  prev?: number | null;
  unit?: string | null;
  impact?: string | null;
}

export interface MatchFeedEvent {
  id: string;
  currency: string;
  title: string;
  release_at: string;
  forecast: string | null;
  previous: string | null;
}

export interface MatchResult {
  feedId: string;
  feedTitle: string;
  providerEvent: string;
  score: number;
  dtMin: number;
  provider: ProviderEvent;
}

export interface UnmatchedInfo {
  id: string;
  title: string;
  reason: 'no_candidate_in_window' | 'low_score' | 'ambiguous' | 'provider_event_taken';
  bestScore?: number;
  bestProviderEvent?: string;
}

export interface MatchOptions {
  windowMin?: number;
  minScore?: number;
  minMargin?: number;
}

const COUNTRY_TO_CCY: Record<string, string> = {
  US: 'USD', EU: 'EUR', EA: 'EUR', EZ: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  GB: 'GBP', UK: 'GBP', JP: 'JPY', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF',
};

const STOP = new Set(['the', 'of', 'and', 'in', 'for', 'to', 'a', 's']);
const SYN: [RegExp, string][] = [
  [/non-?farm/g, 'nonfarm'],
  [/\by\/y\b|\byear[- ]over[- ]year\b/g, 'yoy'],
  [/\bm\/m\b|\bmonth[- ]over[- ]month\b/g, 'mom'],
  [/\bq\/q\b|\bquarter[- ]over[- ]quarter\b/g, 'qoq'],
  [/\bconsumer price index\b/g, 'cpi'],
  [/\bproducer price index\b/g, 'ppi'],
  [/\bgross domestic product\b/g, 'gdp'],
  [/\bpurchasing managers'? index\b/g, 'pmi'],
  [/\bpayrolls?\b/g, 'employment change'],
  [/\b(initial |continuing )?(jobless|unemployment) claims\b/g, 'claims'],
];

function titleTokens(title: string): Set<string> {
  let t = (title || '').toLowerCase();
  for (const [re, rep] of SYN) t = t.replace(re, ` ${rep} `);
  t = t.replace(/[^a-z0-9]+/g, ' ');
  return new Set(t.split(' ').filter(w => w && !STOP.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
}

function close(a: number, b: number): boolean {
  const tol = 0.005 * Math.max(Math.abs(a), Math.abs(b), 1e-9) + 1e-9;
  return Math.abs(a - b) <= tol;
}

/** Apakah string feed ("175K") sama dengan angka provider (175 + unit "K" / 175000)? */
function compatible(ffStr: string | null, num: number | null | undefined, unit?: string | null): boolean {
  const ff = parseEconValue(ffStr);
  if (ff === null || num === null || num === undefined || !Number.isFinite(num)) return false;
  const u = (unit || '').trim().toLowerCase();
  const scaleU = SCALE[u] ?? 1;
  const cands = scaleU === 1 ? [num] : [num * scaleU, num];
  return cands.some(c => close(ff, c));
}

export function parseProviderTime(t?: string | null): number | null {
  if (!t) return null;
  const s = String(t).trim().replace(' ', 'T');
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const ms = new Date(hasTz ? s : s + 'Z').getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Format angka provider supaya mirip tampilan feed ("3.9%", "175K"). */
export function formatProviderValue(value: number | null | undefined, unit?: string | null): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const u = (unit || '').trim();
  const clean = (n: number) => Number(n.toFixed(4)).toString();
  if (u === '%') return clean(value) + '%';
  if (/^[kmbt]$/i.test(u)) return clean(value) + u.toUpperCase();
  const abs = Math.abs(value);
  if (!u && abs >= 1e9) return clean(value / 1e9) + 'B';
  if (!u && abs >= 1e6) return clean(value / 1e6) + 'M';
  if (!u && abs >= 1e3) return clean(value / 1e3) + 'K';
  return clean(value);
}

/**
 * Cocokkan event feed dengan event provider secara KONSERVATIF.
 * Lebih baik tidak menampilkan actual daripada menampilkan actual yang salah.
 * Skor = kemiripan judul (0–1) + 0.6 jika forecast cocok + 0.4 jika previous cocok.
 */
export function matchProviderActuals(
  feed: MatchFeedEvent[],
  provider: ProviderEvent[],
  opts: MatchOptions = {},
): { matches: MatchResult[]; unmatched: UnmatchedInfo[] } {
  const windowMs = (opts.windowMin ?? 10) * 60_000;
  const minScore = opts.minScore ?? 1.0;
  const minMargin = opts.minMargin ?? 0.3;

  const prov = provider.map((p, idx) => ({
    p,
    idx,
    ccy: COUNTRY_TO_CCY[(p.country || '').toUpperCase()] || '',
    t: parseProviderTime(p.time),
    tokens: titleTokens(p.event || ''),
  }));

  type Cand = { idx: number; score: number; dtMin: number };
  const picks: { fe: MatchFeedEvent; best: Cand }[] = [];
  const unmatched: UnmatchedInfo[] = [];

  for (const fe of feed) {
    const ft = new Date(fe.release_at).getTime();
    const ftokens = titleTokens(fe.title);
    const cands: Cand[] = [];
    for (const pv of prov) {
      if (pv.ccy !== fe.currency || pv.t === null) continue;
      const dt = Math.abs(pv.t - ft);
      if (dt > windowMs) continue;
      let score = jaccard(ftokens, pv.tokens);
      if (compatible(fe.forecast, pv.p.estimate, pv.p.unit)) score += 0.6;
      if (compatible(fe.previous, pv.p.prev, pv.p.unit)) score += 0.4;
      cands.push({ idx: pv.idx, score, dtMin: Math.round(dt / 60000) });
    }
    if (!cands.length) {
      unmatched.push({ id: fe.id, title: fe.title, reason: 'no_candidate_in_window' });
      continue;
    }
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0];
    const second = cands[1]?.score ?? 0;
    const bestName = provider[best.idx].event;
    if (best.score < minScore) {
      unmatched.push({ id: fe.id, title: fe.title, reason: 'low_score', bestScore: round2(best.score), bestProviderEvent: bestName });
      continue;
    }
    if (best.score - second < minMargin) {
      unmatched.push({ id: fe.id, title: fe.title, reason: 'ambiguous', bestScore: round2(best.score), bestProviderEvent: bestName });
      continue;
    }
    picks.push({ fe, best });
  }

  // Satu event provider hanya boleh dipakai satu event feed (skor tertinggi menang).
  picks.sort((a, b) => b.best.score - a.best.score);
  const used = new Set<number>();
  const matches: MatchResult[] = [];
  for (const { fe, best } of picks) {
    if (used.has(best.idx)) {
      unmatched.push({ id: fe.id, title: fe.title, reason: 'provider_event_taken' });
      continue;
    }
    used.add(best.idx);
    matches.push({
      feedId: fe.id,
      feedTitle: fe.title,
      providerEvent: provider[best.idx].event ?? '',
      score: round2(best.score),
      dtMin: best.dtMin,
      provider: provider[best.idx],
    });
  }
  return { matches, unmatched };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
