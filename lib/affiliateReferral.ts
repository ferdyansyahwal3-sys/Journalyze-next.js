// lib/affiliateReferral.ts
// Mencatat referral affiliate. Dipanggil LANGSUNG dari webhook Midtrans (server-side),
// bukan lewat HTTP, sehingga tidak ada endpoint publik yang bisa dipakai membuat referral palsu.
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMMISSION_MAP, PRICE_MAP } from '@/lib/affiliateConfig'

export interface ReferralInput {
  orderId: string
  buyerEmail: string
  buyerName?: string | null
  planType: string
  affiliateCode: string
}

export type ReferralResult =
  | { ok: true; note?: 'already tracked' }
  | { ok: false; reason: 'invalid_input' | 'affiliate_not_found' | 'db_error'; message?: string }

export async function recordAffiliateReferral(
  db: SupabaseClient,
  input: ReferralInput
): Promise<ReferralResult> {
  const orderId    = String(input.orderId ?? '').trim()
  const buyerEmail = String(input.buyerEmail ?? '').trim()
  const planKey    = String(input.planType ?? '').trim().toLowerCase()
  // Kode affiliate hanya huruf & angka. Karakter lain (termasuk wildcard % dan _ untuk ilike) dibuang.
  const code       = String(input.affiliateCode ?? '').replace(/[^A-Za-z0-9]/g, '')

  if (!orderId || !buyerEmail || !planKey || !code) {
    return { ok: false, reason: 'invalid_input' }
  }

  // Idempotency: order sudah pernah tercatat?
  const { data: existing } = await db
    .from('affiliate_referrals')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existing) return { ok: true, note: 'already tracked' }

  const { data: affiliate, error: affErr } = await db
    .from('affiliates')
    .select('id, name')
    .ilike('affiliate_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (affErr) return { ok: false, reason: 'db_error', message: affErr.message }
  if (!affiliate) return { ok: false, reason: 'affiliate_not_found' }

  const { error: insertErr } = await db.from('affiliate_referrals').insert({
    affiliate_id: affiliate.id,
    order_id:     orderId,
    buyer_email:  buyerEmail,
    buyer_name:   input.buyerName || null,
    plan_type:    planKey,
    plan_price:   PRICE_MAP[planKey] ?? 0,
    commission:   COMMISSION_MAP[planKey] ?? 0,
    status:       'pending',
  })

  if (insertErr) {
    // 23505 = unique violation → sudah ada (webhook paralel)
    if (insertErr.code === '23505') return { ok: true, note: 'already tracked' }
    return { ok: false, reason: 'db_error', message: insertErr.message }
  }

  console.log(`[AFFILIATE] ✅ Referral tercatat: order ${orderId}, ${affiliate.name} (${code}), komisi ${COMMISSION_MAP[planKey] ?? 0}`)
  return { ok: true }
}
