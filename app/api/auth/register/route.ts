import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'
import { ensureAccountKey } from '@/lib/accountKey'

// Whitelist sumber pendaftaran yang berhak langsung dapat trial.
// Jangan percaya string bebas dari client.
const TRIAL_SOURCES = ['uji-coba']
const TRIAL_DURATION_MS = 48 * 60 * 60 * 1000 // 48 jam

export async function POST(req: NextRequest) {
  try {
    const { nama, email, password, source } = await req.json()

    // Validasi input
    if (!nama || !email || !password) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    // Buat user di Supabase Auth
    const { data, error } = await _sbAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // langsung confirmed, tidak perlu verifikasi email
      user_metadata: { display_name: nama.trim() },
    })

    if (error) {
      // Email sudah terdaftar
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Trial hanya untuk akun BARU yang dibuat di route ini dan datang dari sumber yang di-whitelist.
    // Karena akun baru pasti belum pernah trial, "1x per akun" otomatis terjamin.
    const isTrialSignup = typeof source === 'string' && TRIAL_SOURCES.includes(source)
    const now = new Date()

    const profileRow: Record<string, unknown> = isTrialSignup
      ? {
          id: data.user.id,
          email: email.trim(),
          display_name: nama.trim(),
          plan: 'trial',
          plan_type: 'trial',
          plan_activated_at: now.toISOString(),
          plan_expires_at: new Date(now.getTime() + TRIAL_DURATION_MS).toISOString(),
          trial_used: true,
          is_activated: false,
          admin_verified: false,
        }
      : {
          id: data.user.id,
          email: email.trim(),
          display_name: nama.trim(),
          plan: 'free',
          trial_used: false,
          is_activated: false,
        }

    // Insert ke tabel profiles
    const { error: profileError } = await _sbAdmin
      .from('profiles')
      .insert(profileRow)

    if (profileError) {
      console.error('Profile insert error:', profileError)
      // User sudah dibuat di auth, tapi profile gagal — tetap lanjut
    }

    // Kode akun otomatis (non-fatal)
    await ensureAccountKey(data.user.id, nama)

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
