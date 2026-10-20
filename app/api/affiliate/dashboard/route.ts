// app/api/affiliate/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')?.trim()

    if (!token) {
      return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 })
    }

    const { data: affiliate, error: affErr } = await _sbAdmin
      .from('affiliates')
      .select('id, name, email, affiliate_code, affiliate_slug, bank_name, bank_account, bank_holder')
      .eq('dashboard_token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (affErr) {
      console.error('[AFFILIATE/DASHBOARD] DB error:', affErr.message)
      return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 })
    }

    if (!affiliate) {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kadaluarsa.' }, { status: 404 })
    }

    const { data: referrals } = await _sbAdmin
      .from('affiliate_referrals')
      .select('id, created_at, buyer_name, buyer_email, plan_type, plan_price, commission, status, paid_at, payout_batch')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })

    const { data: events } = await _sbAdmin
      .from('affiliate_link_events')
      .select('event_type')
      .eq('affiliate_code', affiliate.affiliate_slug.toLowerCase())

    const evts = events ?? []
    const funnel = {
      landing_views:   evts.filter(e => e.event_type === 'landing_view').length,
      cta_clicks:      evts.filter(e => e.event_type === 'cta_click').length,
      order_views:     evts.filter(e => e.event_type === 'order_view').length,
      plan_selects:    evts.filter(e => e.event_type === 'plan_select').length,
      checkout_starts: evts.filter(e => e.event_type === 'checkout_start').length,
    }

    return NextResponse.json({ affiliate, referrals: referrals ?? [], funnel })

  } catch (error) {
    console.error('[AFFILIATE/DASHBOARD]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
