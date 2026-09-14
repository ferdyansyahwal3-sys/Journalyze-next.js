import { NextRequest, NextResponse } from 'next/server'
import { _sb } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }

    const { data, error } = await _sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: data.session,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}