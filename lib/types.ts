// lib/types.ts
export interface LicenseKey {
  key: string;
  is_used: boolean;
  is_revoked: boolean;
  customer_name: string | null;
  used_by?: string | null;
  used_at?: string | null;
  created_at?: string | null;
  profiles?: { email: string | null; is_blocked: boolean } | null;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name?: string | null;
  is_admin?: boolean;
  is_blocked?: boolean;
  is_activated?: boolean;
}

// ── Trade (full — sesuai dbRowToTrade di index.html) ──
export interface Trade {
  id: string;
  seq?: number;
  tanggal: string;
  sesi: string;
  pair: string;
  posisi: string;
  lot: number | null;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  close: number | null;
  result: string;
  pips: number | null;
  pl_idr?: number | null;
  _pl?: number | null;       // computed running P/L (display currency)
  _saldo?: number | null;    // computed running saldo (display currency)
  kurs: number | null;
  rr: number | null;
  metode: string;
  strategi: string;
  reason: string;
  reasonFib: string;
  reasonCustom: string;
  catatan: string;
  riskLevel: string;
  emosiKontrol: string;
  source?: string;
  photos: string[];
  fotoAnalisa: string[];
  // Supabase fields
  user_id?: string;
}

// ── DW (full) ──
export interface DW {
  id: string;
  tanggal: string;
  deposit: number;
  withdraw: number;
  catatan?: string;
  _auto?: boolean;
}

export interface DepositWithdrawal {
  user_id: string;
  tanggal: string;
  amount_idr: number;
  type: string;
}

export interface UserAnalytics {
  id: string;
  email: string;
  name: string;
  is_blocked?: boolean;
  is_activated?: boolean;
  trades: number;
  wins: number;
  wr: number;
  lastTrade: string | null;
  favPair: string;
  dwCount: number;
  allTrades: Trade[];
  allDws: DepositWithdrawal[];
}

export type PendingAction =
  | { type: 'revoke' | 'restore'; key: string }
  | { type: 'block' | 'unblock'; email: string }
  | null;
// ── Weekly Review (untuk /live route) ──
export interface WeeklyReview {
  id: string;
  user_id?: string;
  week_start?: string | null;
  week_end?: string | null;
  total_trades?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate?: number | null;
  total_pnl?: number | null;
  notes?: string | null;
}

// ── Monthly Review (untuk /live route) ──
export interface MonthlyReview {
  id: string;
  user_id?: string;
  month?: string | null;
  total_trades?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate?: number | null;
  total_pnl?: number | null;
  notes?: string | null;
}
