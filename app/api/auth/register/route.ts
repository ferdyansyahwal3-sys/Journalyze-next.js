import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    const { nama, email, password } = await req.json()

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

    // Insert ke tabel profiles
    const { error: profileError } = await _sbAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        email: email.trim(),
        display_name: nama.trim(),
        plan: 'free',
        is_activated: false,
      })

    if (profileError) {
      console.error('Profile insert error:', profileError)
      // User sudah dibuat di auth, tapi profile gagal — tetap lanjut
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}