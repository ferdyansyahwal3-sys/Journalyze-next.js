// app/api/affiliate/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

const COMMISSION_MAP: Record<string, number> = {
  basic:   20000,
  pro:     30000,
  elite:   50000,
  premium: 50000, // alias fallback
}

const PRICE_MAP: Record<string, number> = {
  basic:   99000,
  pro:     149000,
  elite:   249000,
  premium: 249000,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      order_id:       string
      buyer_email:    string
      buyer_name?:    string
      plan_type:      string
      affiliate_code: string
    }

    const { order_id, buyer_email, buyer_name, plan_type, affiliate_code } = body

    if (!order_id || !buyer_email || !plan_type || !affiliate_code) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // ── Idempotency: order sudah pernah tercatat? ──
    const { data: existing } = await _sbAdmin
      .from('affiliate_referrals')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle()

    if (existing) {
      console.log('[AFFILIATE/TRACK] Order already tracked, skipping:', order_id)
      return NextResponse.json({ success: true, note: 'already tracked' })
    }

    // ── Cari affiliate berdasarkan kode ──
    const { data: affiliate, error: affErr } = await _sbAdmin
      .from('affiliates')
      .select('id, name')
      .ilike('affiliate_code', affiliate_code.trim())
      .eq('is_active', true)
      .maybeSingle()

    if (affErr) {
      console.error('[AFFILIATE/TRACK] DB error:', affErr.message)
      return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 })
    }

    if (!affiliate) {
      console.warn('[AFFILIATE/TRACK] Affiliate not found for code:', affiliate_code)
      return NextResponse.json({ success: false, error: 'Affiliate not found' })
    }

    const planKey    = plan_type.toLowerCase()
    const commission = COMMISSION_MAP[planKey] ?? 0
    const planPrice  = PRICE_MAP[planKey]      ?? 0

    const { error: insertErr } = await _sbAdmin
      .from('affiliate_referrals')
      .insert({
        affiliate_id: affiliate.id,
        order_id,
        buyer_email,
        buyer_name:  buyer_name || null,
        plan_type:   planKey,
        plan_price:  planPrice,
        commission,
        status:      'pending',
      })

    if (insertErr) {
      // 23505 = unique violation → sudah ada (race condition)
      if (insertErr.code === '23505') {
        console.log('[AFFILIATE/TRACK] Race condition — already inserted for order:', order_id)
        return NextResponse.json({ success: true, note: 'already tracked' })
      }
      console.error('[AFFILIATE/TRACK] Insert error:', insertErr.message)
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 })
    }

    console.log(`[AFFILIATE/TRACK] ✅ Tracked order ${order_id} for affiliate ${affiliate.name} (${affiliate_code}), commission: ${commission}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[AFFILIATE/TRACK] Unhandled error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
