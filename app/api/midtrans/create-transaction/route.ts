import { NextRequest, NextResponse } from 'next/server'
import { _sb, _sbAdmin } from '@/lib/supabaseClient'
import { getMidtransAuthHeader, MIDTRANS_CONFIG, generateOrderId } from '@/lib/midtrans'

const VALID_PAKETS: Record<string, { label: string; nominal: number }> = {
  basic: { label: 'Journalyze Basic - Akses 3 Bulan', nominal: 99000 },
  pro: { label: 'Journalyze Pro - Akses Lifetime', nominal: 149000 },
  elite: { label: 'Journalyze Elite - Lifetime + Review', nominal: 249000 },
}

// Cari user berdasarkan email TANPA batas 50 user (listUsers default hanya halaman pertama)
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null

  // 1) Cari lewat tabel profiles (cepat). Karakter wildcard ilike (\\, %, _) di-escape.
  const escaped = target.replace(/[\\%_]/g, '\\$&')
  const { data: prof } = await _sbAdmin
    .from('profiles')
    .select('id, email')
    .ilike('email', escaped)
    .limit(1)
    .maybeSingle()
  if (prof?.id) return { id: prof.id as string, email: (prof.email as string) || target }

  // 2) Fallback: pindai Auth Admin API per halaman (maks 20.000 user)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await _sbAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return { id: hit.id, email: hit.email || target }
    if (users.length < 1000) break
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paket, promo_code, user_email } = body

    // Validasi paket
    const paketKey = paket in VALID_PAKETS ? paket : 'pro'
    const paketInfo = VALID_PAKETS[paketKey]

    let userId: string
    let userEmail: string
    let userName: string
    let userPhone: string = ''

    // ── Mode A: User sudah login (dari /checkout) ──
    const sessionUser = user_email ? await findUserByEmail(String(user_email)) : null

    if (sessionUser) {
      userId = sessionUser.id
      userEmail = sessionUser.email || ''

      // Ambil data profile
      const { data: profile } = await _sbAdmin
        .from('profiles')
        .select('display_name, phone, plan, admin_verified')
        .eq('id', userId)
        .single()

      if (profile?.plan === 'premium' && profile?.admin_verified === true) {
        return NextResponse.json({ error: 'Akun ini sudah premium.' }, { status: 409 })
      }

      userName = profile?.display_name || userEmail.split('@')[0]
      userPhone = profile?.phone || ''

    } else {
      // ── Mode B: User baru (dari /order) ──
      const { nama, phone, email, password } = body

      if (!nama || !phone || !email || !password) {
        return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
      }
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
      }

      userEmail = email.trim()
      userName = nama.trim()
      userPhone = phone

      // Simpan lead
      await _sbAdmin.from('leads').insert({
        nama: userName,
        email: userEmail,
        phone: userPhone,
        promo_code: promo_code || null,
        status: 'pending',
      })

      // Cek email sudah terdaftar
      const existingUser = await findUserByEmail(userEmail)

      if (existingUser) {
        userId = existingUser.id

        const { data: profile } = await _sbAdmin
          .from('profiles')
          .select('plan, admin_verified')
          .eq('id', userId)
          .single()

        if (profile?.plan === 'premium' && profile?.admin_verified === true) {
          return NextResponse.json({ error: 'Email sudah terdaftar dan sudah premium. Silakan login.' }, { status: 409 })
        }
      } else {
        // Buat akun baru
        const { data: authData, error: authError } = await _sbAdmin.auth.admin.createUser({
          email: userEmail,
          password,
          email_confirm: true,
          user_metadata: { display_name: userName },
        })

        if (authError) {
          return NextResponse.json({ error: 'Gagal membuat akun. Coba lagi.' }, { status: 400 })
        }

        userId = authData.user.id

        await _sbAdmin.from('profiles').insert({
          id: userId,
          email: userEmail,
          display_name: userName,
          phone: userPhone,
          plan: 'free',
          is_activated: false,
        })
      }
    }

    // ── Validasi & hitung diskon promo ──
    let finalAmount = paketInfo.nominal

    if (promo_code) {
      const { data: promo } = await _sbAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', (promo_code as string).toUpperCase())
        .eq('is_active', true)
        .single()

      if (promo) {
        const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date()
        const isMaxed = promo.max_uses !== null && promo.used_count >= promo.max_uses

        if (!isExpired && !isMaxed) {
          if (promo.discount_type === 'fixed') {
            finalAmount = paketInfo.nominal - promo.discount_value
          } else {
            finalAmount = paketInfo.nominal * (1 - promo.discount_value / 100)
          }
          finalAmount = Math.max(Math.round(finalAmount), 1000) // minimum Rp1.000

          // Increment used_count
          await _sbAdmin
            .from('promo_codes')
            .update({ used_count: promo.used_count + 1 })
            .eq('id', promo.id)
        }
      }
    }

    // Generate order ID & buat transaksi Midtrans
    const orderId = generateOrderId(userId)

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: finalAmount,
      },
      customer_details: {
        first_name: userName,
        email: userEmail,
        phone: userPhone,
      },
      item_details: [
        {
          id: `JOURNALYZE-${paketKey.toUpperCase()}`,
          price: finalAmount,
          quantity: 1,
          name: paketInfo.label,
        },
      ],
      callbacks: {
        finish: `https://journalyze.my.id/journal?payment=success`,
        error: `https://journalyze.my.id/checkout?paket=${paketKey}&payment=failed`,
        pending: `https://journalyze.my.id/journal?payment=pending`,
      },
      notification_url: 'https://journalyze.my.id/api/midtrans/webhook',
      custom_field1: userId,
      custom_field2: userEmail,
      custom_field3: paketKey,
    }

    const response = await fetch(MIDTRANS_CONFIG.snapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getMidtransAuthHeader(),
      },
      body: JSON.stringify(payload),
    })

    const txData = await response.json()

    if (!response.ok) {
      console.error('Midtrans error:', txData)
      return NextResponse.json({ error: 'Gagal membuat transaksi pembayaran.' }, { status: 500 })
    }

    // Meta CAPI: simpan konteks browser (user agent, IP, cookie _fbp/_fbc) untuk Purchase dari webhook
    try {
      const forwarded = req.headers.get('x-forwarded-for') || ''
      await _sbAdmin.from('pixel_order_context').insert({
        order_id: orderId,
        user_agent: req.headers.get('user-agent') || null,
        client_ip: forwarded.split(',')[0].trim() || null,
        fbp: req.cookies.get('_fbp')?.value || null,
        fbc: req.cookies.get('_fbc')?.value || null,
        source_url: req.headers.get('referer') || null,
      })
    } catch (ctxError) {
      console.warn('pixel_order_context insert skipped:', ctxError)
    }

    // Update lead & profile dengan order ID
    await _sbAdmin.from('leads').update({ midtrans_order_id: orderId }).eq('email', userEmail)
    await _sbAdmin.from('profiles').update({ midtrans_order_id: orderId }).eq('id', userId)

    return NextResponse.json({
      token: txData.token,
      redirect_url: txData.redirect_url,
      order_id: orderId,
      final_amount: finalAmount,
    })

  } catch (error) {
    console.error('Create transaction error:', error)
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}