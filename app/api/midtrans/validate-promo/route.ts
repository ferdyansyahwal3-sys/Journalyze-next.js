// app/api/midtrans/validate-promo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

const VALID_PAKETS: Record<string, { nominal: number }> = {
  basic: { nominal: 99000 },
  pro:   { nominal: 149000 },
  elite: { nominal: 249000 },
}

export async function POST(req: NextRequest) {
  try {
    const { promo_code, paket } = await req.json()

    if (!promo_code) {
      return NextResponse.json({ error: 'Kode promo tidak boleh kosong.' }, { status: 400 })
    }

    const paketInfo = VALID_PAKETS[paket] ?? VALID_PAKETS['pro']

    const { data: promo, error } = await _sbAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', (promo_code as string).toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !promo) {
      return NextResponse.json({ error: 'Kode promo tidak ditemukan atau sudah tidak aktif.' }, { status: 404 })
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Kode promo sudah expired.' }, { status: 400 })
    }

    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      return NextResponse.json({ error: 'Kode promo sudah mencapai batas penggunaan.' }, { status: 400 })
    }

    let finalAmount: number
    if (promo.discount_type === 'fixed') {
      finalAmount = paketInfo.nominal - promo.discount_value
    } else {
      finalAmount = paketInfo.nominal * (1 - promo.discount_value / 100)
    }
    finalAmount = Math.max(Math.round(finalAmount), 1000)

    return NextResponse.json({
      valid: true,
      final_amount: finalAmount,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      description: promo.description,
    })

  } catch (err) {
    console.error('validate-promo error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
