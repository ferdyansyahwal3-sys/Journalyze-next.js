// lib/riskCalc.ts
// Dipindah verbatim dari index.html baris 3804-4430.
// Fungsi murni (pure) — tidak ada DOM manipulation di sini.
// Semua fungsi yang berkaitan dengan currency, pip, dan kalkulasi risk.

// ── Live rates — diisi oleh hook useRates ──
export let liveRates: Record<string, number> = {
  USD_IDR: 16462,
  JPY_IDR: 108,
  EUR_IDR: 17800,
  GBP_IDR: 20500,
};
export function applyRates(cache: Record<string, number>) {
  liveRates.USD_IDR = cache.USD_IDR || 16462;
  liveRates.JPY_IDR = cache.JPY_IDR || 108;
  liveRates.EUR_IDR = cache.EUR_IDR || 17800;
  liveRates.GBP_IDR = cache.GBP_IDR || 20500;
}

// ── Currency helpers ──
export type Currency = 'IDR' | 'CENT' | 'USD';

export function parseInputVal(raw: string, cur: Currency): number {
  if (cur === 'IDR' || cur === 'CENT') {
    // Titik sebagai pemisah ribuan, bukan desimal
    return parseFloat(raw.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
  }
  // USD: titik sebagai desimal (e.g. 100.50)
  return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
}

export function inputToIDR(val: number, cur: Currency): number {
  const kurs = liveRates.USD_IDR || 16462;
  switch (cur) {
    case 'USD':  return val * kurs;
    case 'CENT': return (val / 100) * kurs;
    default:     return val;
  }
}

export function idrToDisp(idrVal: number, cur: Currency): number {
  const kurs = liveRates.USD_IDR || 16462;
  switch (cur) {
    case 'USD':  return Math.round((idrVal / kurs) * 100) / 100;
    case 'CENT': return Math.round((idrVal / kurs) * 100 * 10) / 10;
    default:     return Math.round(idrVal);
  }
}

export function fmtDispCur(val: number, cur: Currency): string {
  switch (cur) {
    case 'USD':  return '$' + val.toFixed(2);
    case 'CENT': return fmtCentVal(Math.abs(val)) + '¢';
    default:     return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  }
}

export function fmtCentVal(abs: number): string {
  const fixed = abs.toFixed(1);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return intFormatted + '.' + decPart;
}

export function fmtMoney(n: number | null | undefined, cur: Currency): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n), sign = n >= 0 ? '+' : '-';
  switch (cur) {
    case 'IDR':  return sign + 'Rp ' + abs.toLocaleString('id-ID');
    case 'CENT': return sign + fmtCentVal(abs) + '¢';
    case 'USD':  return sign + '$' + abs.toFixed(2);
    default:     return sign + String(abs);
  }
}

export function rpFull(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// ── Pip utilities ──
export function getPipSize(pair: string): number {
  if (pair === 'XAUUSD') return 0.1;
  if (pair === 'BTCUSD') return 1;
  if (pair === 'USDJPY') return 0.01;
  if (pair === 'NASDAQ') return 0.01;
  return 0.0001;
}

export function getPipValue(pair: string, cur: Currency): number {
  if (cur === 'CENT') {
    if (pair === 'XAUUSD') return 10;
    if (pair === 'BTCUSD') return 100;
    if (pair === 'NASDAQ') return 10;
    if (pair === 'GBPUSD') return 10;
    if (pair === 'USDJPY') {
      const jpyRate = (liveRates.USD_IDR || 16462) / (liveRates.JPY_IDR || 108);
      return 1000 / jpyRate;
    }
    return 10;
  }
  if (pair === 'XAUUSD') return 10;
  if (pair === 'BTCUSD') return 1;
  if (pair === 'USDJPY') return 9.1;
  return 10;
}

export function calcPips(entry: number, close: number, pair: string, result: string): number {
  if (!entry || !close || !pair) return 0;
  const ps = getPipSize(pair);
  const raw = Math.abs(close - entry) / ps;
  const pips = Math.round(raw * 100) / 100;
  return result === 'Profit' ? pips : -pips;
}

// kursOverride (opsional): kurs USD→IDR yang dikunci saat trade disimpan.
// Kalau tidak diisi / tidak valid, pakai kurs live.
// Hanya berpengaruh di mode IDR (CENT & USD tidak butuh kurs).
// Semua kalkulasi intermediate pakai presisi penuh, pembulatan hanya di akhir.
export function calcPL(
  pips: number,
  lot: number,
  pair: string,
  cur: Currency,
  kursOverride?: number
): number {
  if (!pips || !lot || !pair) return 0;
  const absPips = Math.abs(pips);
  const arah = pips >= 0 ? 1 : -1;
  const kurs = kursOverride && kursOverride > 1000 ? kursOverride : (liveRates.USD_IDR || 16462);
  const pv = getPipValue(pair, cur);
  const raw = arah * absPips * lot * pv;
  switch (cur) {
    case 'IDR':  return Math.round(raw * kurs);
    case 'CENT': return Math.round(raw * 10) / 10;
    case 'USD':  return Math.round(raw * 100) / 100;
    default:     return Math.round(raw * kurs);
  }
}

// ── Risk profile formulas ──
export function getTipeAkun(b: number, cur: Currency): string {
  if (!b) return '';
  // Konversi semua ke IDR dulu biar threshold konsisten
  const kurs = liveRates.USD_IDR || 16462;
  let bIDR: number;
  if (cur === 'CENT') bIDR = (b / 100) * kurs;
  else if (cur === 'USD') bIDR = b * kurs;
  else bIDR = b;

  if (bIDR < 1e6)  return 'Cent';             // < Rp 1jt
  if (bIDR < 5e6)  return 'Cent / Standard';  // Rp 1jt – 5jt
  if (bIDR < 30e6) return 'Standard';         // Rp 5jt – 30jt
  return 'Standard / Pro';                     // > Rp 30jt
}

export function getAccDesc(t: string): string {
  const m: Record<string, string> = {
    'Cent':             'Akun Cent ideal untuk pemula & modal kecil (<Rp1jt). Tersedia di Exness & HFM.',
    'Cent / Standard':  'Modal cukup untuk Cent atau mulai Standard. Cent lebih aman untuk belajar, Standard untuk yang sudah konsisten.',
    'Standard':         'Akun Standard cocok untuk modal Rp5jt–30jt. Tersedia di hampir semua broker.',
    'Standard / Pro':   'Modal besar, pertimbangkan akun Pro atau Raw Spread untuk spread lebih rendah.',
  };
  return m[t] || '—';
}

export function getLotByBal(b: number, cur: Currency): number {
  if (!b || b <= 0) return 0.01;

  // Akun CENT: threshold langsung dalam ¢ (skala beda dari IDR/USD)
  if (cur === 'CENT') {
    if (b <= 500)   return 0.01;
    if (b <= 2000)  return 0.02;
    if (b <= 5000)  return 0.05;
    if (b <= 10000) return 0.10;
    if (b <= 25000) return 0.20;
    if (b <= 60000) return 0.50;
    return 1.00;
  }

  // IDR & USD: konversi ke IDR dulu
  const kurs = liveRates.USD_IDR || 16462;
  const bIDR = cur === 'USD' ? b * kurs : b;

  if (bIDR <= 1_500_000)   return 0.01;
  if (bIDR <= 5_000_000)   return 0.02;
  if (bIDR <= 10_000_000)  return 0.03;
  if (bIDR <= 20_000_000)  return 0.05;
  if (bIDR <= 50_000_000)  return 0.10;
  if (bIDR <= 100_000_000) return 0.20;
  return 0.50;
}

export function getLayer(b: number, cur: Currency): string {
  if (!b) return '';
  // Konversi ke IDR dulu
  const kurs = liveRates.USD_IDR || 16462;
  let bIDR: number;
  if (cur === 'CENT') bIDR = (b / 100) * kurs;
  else if (cur === 'USD') bIDR = b * kurs;
  else bIDR = b;

  if (bIDR < 500_000)   return '1 Layer';
  if (bIDR <= 1_000_000) return '1-2 Layer';
  if (bIDR <= 3_000_000) return '2-3 Layer';
  if (bIDR <= 5_000_000) return '3-4 Layer';
  if (bIDR <= 10_000_000) return '4-5 Layer';
  return '5-7 Layer';
}

export function getSL(p: string): string {
  const m: Record<string, string> = {
    XAUUSD: '30—50 pips', EURUSD: '20—30 pips', GBPUSD: '20—30 pips',
    USDJPY: '20—30 pips', BTCUSD: '40—50 pips', NASDAQ: '40—50 pips',
  };
  return m[p] || 'Sesuaikan dengan volatilitas';
}

export function getProfil(r: string | number): { l: string; c: string; e: string } {
  const v = parseFloat(String(r));
  if (v <= 1) return { l: 'Konservatif', c: 'cons', e: '🛡️' };
  if (v <= 2) return { l: 'Moderat', c: 'mod', e: '⚖️' };
  if (v <= 3) return { l: 'Agresif', c: 'agg', e: '🔥' };
  return { l: 'Ekstrem', c: 'ext', e: '⚠️' };
}

export function getMindset(r: string | number): string {
  const v = parseFloat(String(r));
  if (v <= 1) return 'Fokus ke akurasi setup; bukan banyak entry.';
  if (v <= 2) return 'Seimbangkan sabar dan ambisi; jaga disiplin lot.';
  if (v <= 3) return 'Kendalikan emosi dan batasi overtrade.';
  return 'Turunkan risiko; utamakan ketahanan akun.';
}

export function calcDailyGrowth(bal: number, tgt: number, mo: number): number {
  return Math.pow(tgt / bal, 1 / (mo * 22)) - 1;
}

export function calcMarginIDR(pair: string, leverage: number, kurs?: number): number {
  if (!leverage || leverage <= 0) return 0;
  kurs = kurs || (liveRates.USD_IDR || 16462);
  const contractMap: Record<string, number> = { XAUUSD: 100, USDJPY: 100000, GBPUSD: 100000, BTCUSD: 1, NASDAQ: 1 };
  const contract = contractMap[pair] || 100000;
  const priceUSD: Record<string, number> = { XAUUSD: liveRates.XAU_USD || 2350, USDJPY: 1, GBPUSD: 1, BTCUSD: liveRates.BTC_USD || 60000, NASDAQ: liveRates.NAS_USD || 18000 };
  const price = priceUSD[pair] || 1;
  const marginUSD = (contract * price) / leverage;
  return Math.round((marginUSD / 100) * kurs);
}

export function getLeverageHint(lev: number): string {
  const h: Record<number, string> = {
    100: 'Konservatif — margin besar, cocok pemula.',
    200: 'Standar — keseimbangan baik antara margin & fleksibilitas.',
    500: 'Umum di broker Indonesia — margin lebih kecil.',
    1000: 'Tinggi — cocok trader berpengalaman, waspadai margin call.',
    2000: 'Sangat tinggi — margin minimal, risiko margin call besar.',
    3000: 'Ekstrem — hanya untuk scalper berpengalaman. Sangat berisiko.',
  };
  return h[lev] || 'Sesuaikan dengan broker kamu.';
}

// ── Rates cache ──
export const RATES_CACHE_KEY = 'jz_rates_cache';
export const RATES_CACHE_TTL = 3 * 60 * 60 * 1000; // kurs di-refresh tiap 3 jam

export function buildRatesTicker(cache: Record<string, number>, stale = false): {
  items: { p: string; r: string }[];
  timeLabel: string;
} {
  const items = [
    { p: 'USD/IDR', r: Math.round(cache.USD_IDR || 16462).toLocaleString('id-ID') },
    { p: 'EUR/IDR', r: Math.round(cache.EUR_IDR || 17800).toLocaleString('id-ID') },
    { p: 'GBP/IDR', r: Math.round(cache.GBP_IDR || 20500).toLocaleString('id-ID') },
    { p: 'JPY/IDR', r: (cache.JPY_IDR || 108).toFixed(1) },
  ];
  // srcTs = waktu update asli dari sumber kurs (kalau ada), supaya label jujur soal umur data
  const refTs = cache.srcTs || cache.ts;
  const age = refTs ? Math.round((Date.now() - refTs) / 60000) : null;
  const ageStr = age !== null ? (age < 60 ? age + 'm lalu' : Math.round(age / 60) + 'j lalu') : '—';
  return { items, timeLabel: (stale ? 'Offline: ' : '') + ageStr };
}
