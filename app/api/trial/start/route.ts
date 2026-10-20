// app/api/trial/start/route.ts
// Mulai trial 2 hari untuk user free yang belum pernah trial.
import { NextRequest, NextResponse } from 'next/server'
import { _sb, _sbAdmin } from '@/lib/supabaseClient'

const TRIAL_DURATION_MS = 48 * 60 * 60 * 1000 // 48 jam

export async function POST(req: NextRequest) {
  try {
    // ── 1. Verifikasi token (pola sama dengan lib/adminAuth.ts) ──
    const header = req.headers.get('authorization') || ''
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: authData, error: authError } = await _sb.auth.getUser(token)
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = authData.user

    // ── 2. Update ATOMIK ──
    // Kondisi (plan = free AND trial_used = false) ikut di dalam query UPDATE,
    // jadi dua request bersamaan tidak bisa sama-sama lolos (tidak ada race cek-lalu-tulis).
    const now = new Date()
    const expiresAt = new Date(now.getTime() + TRIAL_DURATION_MS).toISOString()

    const { data: updated, error: updateError } = await _sbAdmin
      .from('profiles')
      .update({
        plan: 'trial',
        plan_type: 'trial',
        plan_activated_at: now.toISOString(),
        plan_expires_at: expiresAt,
        trial_used: true,
      })
      .eq('id', user.id)
      .eq('plan', 'free')
      .eq('trial_used', false)
      .select('id')

    if (updateError) {
      console.error('[trial/start] update error:', updateError)
      return NextResponse.json({ error: 'Gagal memulai trial. Coba lagi.' }, { status: 500 })
    }

    // Tidak ada baris yang terupdate → sudah pernah trial / bukan paket free
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'Trial sudah pernah dipakai atau akun bukan paket free.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, expiresAt })
  } catch (error) {
    console.error('[trial/start] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
