// store/useTradeStore.ts
// Zustand store untuk trades & DW — pengganti variabel global `trades` dan `dwList`
// di index.html. Semua komponen (PageData, PageFilter, PageWeekly, PageMonthly)
// akan baca dari sini.
import { create } from 'zustand';
import type { Trade, DW } from '@/lib/types';
import {
  liveRates,
  calcPips, calcPL, idrToDisp,
  type Currency,
} from '@/lib/riskCalc';
import { _sb } from '@/lib/supabaseClient';


// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function seqOf(t: Trade): number {
  if (t.seq != null) return t.seq;
  return parseInt(t.id) || 0;
}

// dbRowToTrade — 1:1 dengan index.html
export function dbRowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    tanggal: row.tanggal as string,
    sesi: (row.sesi as string) || '',
    pair: (row.pair as string) || '',
    posisi: (row.posisi as string) || '',
    lot: row.lot != null ? parseFloat(row.lot as string) : null,
    entry: row.entry != null ? parseFloat(row.entry as string) : null,
    sl: row.sl != null ? parseFloat(row.sl as string) : null,
    tp: row.tp != null ? parseFloat(row.tp as string) : null,
    close: row.close_price != null ? parseFloat(row.close_price as string) : null,
    result: (row.result as string) || '',
    pips: row.pips != null ? parseFloat(row.pips as string) : null,
    pl_idr: row.pl_idr != null ? parseFloat(row.pl_idr as string) : null,
    kurs: row.kurs != null ? parseFloat(row.kurs as string) : null,
    rr: row.rr != null ? parseFloat(row.rr as string) : null,
    metode: Array.isArray(row.strategi) ? (row.strategi as string[]).join(', ') : ((row.strategi as string) || ''),
    strategi: Array.isArray(row.strategi) ? (row.strategi as string[]).join(', ') : ((row.strategi as string) || ''),
    reason: (row.reason as string) || '',
    reasonFib: (row.reason_fib as string) || '',
    reasonCustom: (row.reason_custom as string) || '',
    catatan: (row.catatan as string) || '',
    riskLevel: (row.risk_level as string) || '',
    emosiKontrol: (row.emosi_kontrol as string) || '',
    source: (row.source as string) || 'manual',
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
    fotoAnalisa: Array.isArray(row.foto_analisa) ? (row.foto_analisa as string[]) : [],
    seq: row.created_at
      ? new Date(row.created_at as string).getTime()
      : (parseInt(row.id as string) || undefined),
  };
}

function tradeToDbRow(t: Trade, userId: string): Record<string, unknown> {
  if (!isValidUUID(t.id)) t.id = crypto.randomUUID();
  const strArr = (t.metode || t.strategi || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    id: t.id, user_id: userId, tanggal: t.tanggal,
    sesi: t.sesi || null, pair: t.pair || null, posisi: t.posisi || null,
    lot: t.lot != null ? parseFloat(String(t.lot)) : null,
    entry: t.entry != null ? parseFloat(String(t.entry)) : null,
    sl: t.sl != null ? parseFloat(String(t.sl)) : null,
    tp: t.tp != null ? parseFloat(String(t.tp)) : null,
    close_price: t.close != null ? parseFloat(String(t.close)) : null,
    result: t.result || null,
    pips: t.pips != null ? parseFloat(String(t.pips)) : null,
    pl_idr: t.pl_idr != null ? parseFloat(String(t.pl_idr)) : (t._pl != null ? parseFloat(String(t._pl)) : null),
    kurs: t.kurs != null ? parseFloat(String(t.kurs)) : null,
    rr: t.rr != null ? parseFloat(String(t.rr)) : null,
    strategi: strArr.length ? strArr : null,
    reason: t.reason || null, reason_fib: t.reasonFib || null, reason_custom: t.reasonCustom || null,
    catatan: t.catatan || null, risk_level: t.riskLevel || null, emosi_kontrol: t.emosiKontrol || null,
    source: t.source || 'manual',
    photos: Array.isArray(t.photos) && t.photos.length ? t.photos : null,
    foto_analisa: Array.isArray(t.fotoAnalisa) && t.fotoAnalisa.length ? t.fotoAnalisa : null,
    updated_at: new Date().toISOString(),
  };
}

function dbRowToDW(row: Record<string, unknown>): DW {
  return {
    id: row.id as string,
    tanggal: row.tanggal as string,
    deposit: row.type === 'deposit' ? parseFloat(row.amount_idr as string) : 0,
    withdraw: row.type === 'withdraw' ? parseFloat(row.amount_idr as string) : 0,
    catatan: (row.catatan as string) || '',
    _auto: (row.is_auto as boolean) || false,
  };
}

function dwToDbRow(dw: DW, userId: string): Record<string, unknown> {
  if (!isValidUUID(dw.id)) dw.id = crypto.randomUUID();
  const isDeposit = (dw.deposit || 0) > 0;
  return {
    id: dw.id, user_id: userId, tanggal: dw.tanggal,
    type: isDeposit ? 'deposit' : 'withdraw',
    amount_idr: isDeposit ? parseFloat(String(dw.deposit || 0)) : parseFloat(String(dw.withdraw || 0)),
    catatan: dw.catatan || null, is_auto: dw._auto || false,
  };
}

// ── recalcAll — 1:1 dengan index.html ─────────────────────────────────────

export function recalcAll(
  trades: Trade[],
  dwList: DW[],
  currency: Currency,
  balanceIDR: number,
  kurs: number
): Trade[] {
  let initBal = idrToDisp(balanceIDR, currency);

  // deduplicate
  const unique = [...new Map(trades.map((t) => [t.id, t])).values()];

  const sorted = [...unique].sort((a, b) => {
    if (a.tanggal < b.tanggal) return -1;
    if (a.tanggal > b.tanggal) return 1;
    return seqOf(a) - seqOf(b);
  });

  // DW lookup (manual only)
  const dwByDate: Record<string, { dep: number; wd: number }> = {};
  dwList.filter((d) => !d._auto).forEach((dw) => {
    if (!dwByDate[dw.tanggal]) dwByDate[dw.tanggal] = { dep: 0, wd: 0 };
    const depIDR = dw.deposit || 0;
    const wdIDR = dw.withdraw || 0;
    dwByDate[dw.tanggal].dep += idrToDisp(depIDR, currency);
    dwByDate[dw.tanggal].wd += idrToDisp(wdIDR, currency);
  });

  let runBal = initBal;
  let runProfit = 0;
  let processedDates = new Set<string>();

  return sorted.map((t) => {
    // Apply DW for this date (first trade of that date)
    if (!processedDates.has(t.tanggal)) {
      processedDates.add(t.tanggal);
      const dw = dwByDate[t.tanggal];
      if (dw) {
        runBal += dw.dep - dw.wd;
      }
    }

    const pl = calcPL(t.pips || 0, t.lot || 0, t.pair, currency);
    runProfit += pl;
    runBal += pl;

    return {
      ...t,
      _pl: Math.round(pl * 100) / 100,
      _saldo: Math.round(runBal * 100) / 100,
    };
  });
}

// ── Store ─────────────────────────────────────────────────────────────────

interface TradeState {
  trades: Trade[];
  dwList: DW[];
  loaded: boolean;

  // Load from localStorage
  loadLocal: () => void;

  // Load from Supabase
  loadCloud: (userId: string) => Promise<void>;

  // CRUD trades
  addTrade: (trade: Trade, userId: string | null) => Promise<void>;
  updateTrade: (trade: Trade, userId: string | null) => Promise<void>;
  deleteTrade: (id: string, userId: string | null) => Promise<void>;
  resetTrades: (userId: string | null) => Promise<void>;

  // CRUD DW
  addDW: (dw: DW, userId: string | null) => Promise<void>;
  deleteDW: (id: string, userId: string | null) => Promise<void>;

  // Persist
  persistLocal: () => void;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  dwList: [],
  loaded: false,

  loadLocal: () => {
    try {
      const t = JSON.parse(localStorage.getItem('jz_trades') || '[]');
      const d = JSON.parse(localStorage.getItem('jz_dw') || '[]');
      set({ trades: t, dwList: d, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  loadCloud: async (userId) => {
    try {
      const { data: trRows } = await _sb
        .from('trades').select('*').eq('user_id', userId).order('tanggal', { ascending: true });
      const { data: dwRows } = await _sb
        .from('deposit_withdrawals').select('*').eq('user_id', userId).order('tanggal', { ascending: true });

      const trades = (trRows || []).map(dbRowToTrade);
      const dwList = (dwRows || []).map(dwToDbRowLocal);

      localStorage.setItem('jz_trades', JSON.stringify(trades));
      localStorage.setItem('jz_dw', JSON.stringify(dwList));
      set({ trades, dwList, loaded: true });
    } catch (e: unknown) {
      console.warn('[useTradeStore] loadCloud error:', (e as Error).message);
      get().loadLocal();
    }
  },

  addTrade: async (trade, userId) => {
    const { trades } = get();
    const newTrades = [...trades, trade].sort((a, b) => {
      if (a.tanggal < b.tanggal) return -1;
      if (a.tanggal > b.tanggal) return 1;
      return seqOf(a) - seqOf(b);
    });
    set({ trades: newTrades });
    get().persistLocal();
    if (userId) {
      try {
        await _sb.from('trades').upsert(tradeToDbRow(trade, userId));
      } catch (e: unknown) { console.warn('[addTrade] cloud error:', (e as Error).message); }
    }
  },

  updateTrade: async (trade, userId) => {
    const newTrades = get().trades.map((t) => t.id === trade.id ? trade : t);
    set({ trades: newTrades });
    get().persistLocal();
    if (userId) {
      try {
        await _sb.from('trades').upsert(tradeToDbRow(trade, userId));
      } catch (e: unknown) { console.warn('[updateTrade] cloud error:', (e as Error).message); }
    }
  },

  deleteTrade: async (id, userId) => {
    const newTrades = get().trades.filter((t) => t.id !== id);
    set({ trades: newTrades });
    get().persistLocal();
    if (userId) {
      try {
        await _sb.from('trades').delete().eq('id', id);
      } catch (e: unknown) { console.warn('[deleteTrade] cloud error:', (e as Error).message); }
    }
  },

  resetTrades: async (userId) => {
    set({ trades: [], dwList: [] });
    localStorage.removeItem('jz_trades');
    localStorage.removeItem('jz_dw');
    if (userId) {
      try {
        await _sb.from('trades').delete().eq('user_id', userId);
        await _sb.from('deposit_withdrawals').delete().eq('user_id', userId);
      } catch (e: unknown) { console.warn('[resetTrades] cloud error:', (e as Error).message); }
    }
  },

  addDW: async (dw, userId) => {
    const newDW = [...get().dwList, dw];
    set({ dwList: newDW });
    localStorage.setItem('jz_dw', JSON.stringify(newDW));
    if (userId) {
      try {
        await _sb.from('deposit_withdrawals').upsert(dwToDbRow(dw, userId));
      } catch (e: unknown) { console.warn('[addDW] cloud error:', (e as Error).message); }
    }
  },

  deleteDW: async (id, userId) => {
    const newDW = get().dwList.filter((d) => d.id !== id);
    set({ dwList: newDW });
    localStorage.setItem('jz_dw', JSON.stringify(newDW));
    if (userId) {
      try {
        await _sb.from('deposit_withdrawals').delete().eq('id', id);
      } catch (e: unknown) { console.warn('[deleteDW] cloud error:', (e as Error).message); }
    }
  },

  persistLocal: () => {
    try {
      localStorage.setItem('jz_trades', JSON.stringify(get().trades));
    } catch { }
  },
}));

// local helper (only used inside this file)
function dwToDbRowLocal(row: Record<string, unknown>): DW {
  return dbRowToDW(row);
}