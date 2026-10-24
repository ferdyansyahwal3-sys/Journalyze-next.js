// app/api/midtrans/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyMidtransSignature } from '@/lib/midtrans'
import { activatePlan, clearPendingPlan, isPaidStatus } from '@/lib/activatePlan'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      custom_field1: userId,
    } = body

    console.log('[WEBHOOK] Incoming:', { order_id, transaction_status, fraud_status, userId })

    // ── Verifikasi signature Midtrans ──
    const isValid = verifyMidtransSignature(order_id, status_code, gross_amount, signature_key)
    if (!isValid) {
      console.error('[WEBHOOK] Invalid Midtrans signature for order:', order_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    if (isPaidStatus(transaction_status, fraud_status)) {
      const result = await activatePlan(body)

      if (result.status === 'db_error') {
        // 500 → Midtrans akan mengirim ulang notifikasi
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }
      if (result.status === 'missing_user') {
        // 200 agar Midtrans tidak retry terus-menerus
        return NextResponse.json({ error: 'Missing userId, ignored' }, { status: 200 })
      }
      return NextResponse.json({ status: 'ok', result: result.status })
    }

    if (transaction_status === 'pending') {
      console.log('[WEBHOOK] Payment pending for order:', order_id)
    } else if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      console.log('[WEBHOOK] Payment failed/cancelled for order:', order_id)
      if (userId) await clearPendingPlan(userId)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WEBHOOK] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
