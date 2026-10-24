// app/api/midtrans/verify/route.ts
//
// Dipanggil dari frontend setelah user selesai bayar (PaymentSuccessModal).
// Tidak percaya data dari browser: status order ditanyakan LANGSUNG ke Midtrans
// memakai server key, lalu paket diaktifkan lewat activatePlan() yang idempotent.
// Jadi tetap jalan di localhost (tanpa webhook) dan jadi cadangan di production.
import { NextRequest, NextResponse } from 'next/server'
import { MIDTRANS_CONFIG, getMidtransAuthHeader } from '@/lib/midtrans'
import { activatePlan, isPaidStatus } from '@/lib/activatePlan'

export const dynamic = 'force-dynamic'

const ORDER_ID_PATTERN = /^JZ-[A-Za-z0-9-]{5,80}$/

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json()

    if (typeof order_id !== 'string' || !ORDER_ID_PATTERN.test(order_id)) {
      return NextResponse.json({ status: 'invalid', error: 'order_id tidak valid' }, { status: 400 })
    }

    const base = MIDTRANS_CONFIG.isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    const res = await fetch(`${base}/v2/${encodeURIComponent(order_id)}/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: getMidtransAuthHeader(),
      },
      cache: 'no-store',
    })
    const data = await res.json()

    // Midtrans membalas HTTP 200 dengan status_code "404" di body kalau order tidak ada
    if (data?.status_code === '404') {
      return NextResponse.json({ status: 'not_found' })
    }
    if (!data?.order_id) {
      console.error('[VERIFY] Respons Midtrans tidak dikenali:', data)
      return NextResponse.json({ status: 'error' }, { status: 502 })
    }

    const { transaction_status, fraud_status } = data

    if (isPaidStatus(transaction_status, fraud_status)) {
      const result = await activatePlan(data)

      if (result.status === 'activated' || result.status === 'already_processed') {
        return NextResponse.json({ status: 'paid', plan: result.paketKey })
      }
      if (result.status === 'db_error') {
        return NextResponse.json({ status: 'error' }, { status: 500 })
      }
      return NextResponse.json({ status: 'error', reason: result.status }, { status: 422 })
    }

    if (transaction_status === 'pending') {
      return NextResponse.json({ status: 'pending' })
    }

    // cancel / deny / expire / failure / refund
    return NextResponse.json({ status: 'failed' })
  } catch (error) {
    console.error('[VERIFY] Unhandled error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
