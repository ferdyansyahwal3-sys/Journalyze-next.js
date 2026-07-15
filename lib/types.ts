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

export interface Trade {
  user_id: string;
  tanggal: string;
  pair: string;
  result: string;
  lot: number;
  pl_idr: number;
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
