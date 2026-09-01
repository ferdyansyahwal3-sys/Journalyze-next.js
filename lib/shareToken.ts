// lib/shareToken.ts
// Utility: generate token unik & fetch share record by token (server-side safe)

import { _sb as supabase } from '@/lib/supabaseClient'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShareRecord {
  id: string
  user_id: string
  token: string
  is_active: boolean
  expires_at: string | null
  show_trades: boolean
  show_equity: boolean
  show_winrate: boolean
  show_plan: boolean
  created_at: string
  updated_at: string
}

// ── Token generator ───────────────────────────────────────────────────────────

/**
 * Hasilkan token random berbentuk "jrn_xxxxxxxx"
 * Pakai Web Crypto API → aman di browser maupun Node (Next.js edge/server).
 */
export function generateToken(prefix = 'jrn'): string {
  const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const slug  = Array.from(bytes)
    .map(b => CHARS[b % CHARS.length])
    .join('')
  return `${prefix}_${slug}`
}

// ── Server-side fetch (dipakai di app/live/[token]/page.tsx) ─────────────────

/**
 * Ambil share record berdasarkan token.
 * Hanya return data jika is_active = true dan belum expired.
 * Return null jika tidak ditemukan / tidak valid.
 */
export async function getShareByToken(token: string): Promise<ShareRecord | null> {
  

  const { data, error } = await supabase
    .from('live_shares')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .single()

  if (error || !data) return null
  return data as ShareRecord
}

// ── Helper: build public URL ──────────────────────────────────────────────────

/**
 * Hasilkan full URL halaman Live publik dari token.
 * Pakai NEXT_PUBLIC_BASE_URL jika ada, fallback ke window.location.origin.
 */
export function buildShareUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/live/${token}`
}