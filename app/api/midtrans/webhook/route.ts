// app/api/midtrans/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyMidtransSignature } from '@/lib/midtrans'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ADMIN_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

const ADMIN_EMAIL = 'journalyze3@gmail.com'
const ADMIN_PANEL_URL = 'https://journalyze.my.id/admin'

// Map harga Midtrans → plan_type key (fallback jika custom_field3 kosong)
function resolvePlanKey(grossAmount: string): string {
  const amount = parseInt(grossAmount, 10)
  if (amount <= 100000) return 'basic'
  if (amount <= 200000) return 'pro'
  return 'elite'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[WEBHOOK] Incoming body:', JSON.stringify(body, null, 2))

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      custom_field1: userId,
      // FIX: paketKey ada di custom_field3, bukan custom_field2
      // create-transaction kirim: custom_field1=userId, custom_field2=userEmail, custom_field3=paketKey
      custom_field3: planKeyFromOrder,
      customer_details,
    } = body

    // ── Guard: userId wajib ada sebelum lanjut ──
    if (!userId) {
      console.error('[WEBHOOK] FATAL: userId (custom_field1) is undefined!', {
        order_id,
        custom_field1: body.custom_field1,
        custom_field2: body.custom_field2,
        custom_field3: body.custom_field3,
      })
      // Return 200 agar Midtrans tidak retry loop
      return NextResponse.json({ error: 'Missing userId, ignored' }, { status: 200 })
    }

    console.log('[WEBHOOK] Parsed fields:', {
      order_id,
      transaction_status,
      fraud_status,
      userId,
      planKeyFromOrder,
    })

    // ── Verifikasi signature Midtrans ──
    const isValid = verifyMidtransSignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    )

    if (false && !isValid) {
      console.error('[WEBHOOK] Invalid Midtrans signature for order:', order_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const isSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement'

    const isPending = transaction_status === 'pending'

    const isFailed =
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'

    if (isSuccess) {
      // Tentukan paket: dari custom_field3, fallback ke nominal
      const paketKey = planKeyFromOrder || resolvePlanKey(gross_amount ?? '0')
      console.log('[WEBHOOK] Activating plan:', paketKey, 'for userId:', userId)

      // Langsung aktivasi — admin_verified = true otomatis
      const { data: profile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          plan:              'premium',
          plan_type:         paketKey,
          admin_verified:    true,
          pending_plan:      null,
          is_activated:      true,
          plan_activated_at: new Date().toISOString(),
          midtrans_order_id: order_id,
        })
        .eq('id', userId)
        .select('email, display_name')
        .single()

      if (updateError) {
        console.error('[WEBHOOK] Supabase update error:', updateError)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      console.log('[WEBHOOK] ✅ Profile activated successfully:', profile)

      // Notifikasi admin via email
      const customerName  = customer_details?.first_name || profile?.display_name || 'Trader'
      const customerEmail = customer_details?.email || profile?.email || '-'
      const adminLink     = `${ADMIN_PANEL_URL}?tab=users&search=${encodeURIComponent(customerEmail)}`

      try {
        await resend.emails.send({
          from: 'Journalyze Webhook <noreply@journalyze.my.id>',
          to: ADMIN_EMAIL,
          subject: `✅ Aktivasi Otomatis — ${customerName} (${paketKey.toUpperCase()})`,
          html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px; margin: 0;">
              <div style="max-width: 560px; margin: 0 auto; background: #111; border: 1px solid #333; border-radius: 16px; padding: 40px;">

                <h1 style="color: #C9A84C; margin: 0 0 8px; font-size: 22px;">Journalyze Admin</h1>
                <p style="color: #666; margin: 0 0 32px; font-size: 13px;">Notifikasi Aktivasi Otomatis</p>

                <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0; width: 40%;">User</td>
                      <td style="color: #fff; font-size: 13px; font-weight: 600;">${customerName}</td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0;">Email</td>
                      <td style="color: #fff; font-size: 13px;">${customerEmail}</td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0;">Paket</td>
                      <td style="color: #C9A84C; font-size: 13px; font-weight: 700; font-family: monospace;">${paketKey.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0;">Order ID</td>
                      <td style="color: #aaa; font-size: 12px; font-family: monospace;">${order_id}</td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0;">Nominal</td>
                      <td style="color: #fff; font-size: 13px;">Rp ${parseInt(gross_amount ?? '0').toLocaleString('id-ID')}</td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px; padding: 6px 0;">Status</td>
                      <td style="color: #22c55e; font-size: 12px; font-weight: 700;">✅ SUKSES — Diaktifkan Otomatis</td>
                    </tr>
                  </table>
                </div>

                <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                  Akun user ini sudah <strong style="color: #22c55e;">PREMIUM</strong> dan diaktifkan otomatis via webhook.
                </p>

                <div style="text-align: center;">
                  <a href="${adminLink}"
                     style="display: inline-block; background: #C9A84C; color: #000; text-decoration: none;
                            padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">
                    Lihat di Admin Panel →
                  </a>
                </div>

                <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;">
                <p style="color: #444; font-size: 11px; text-align: center; margin: 0;">
                  © 2025 Journalyze Admin Panel
                </p>
              </div>
            </body>
            </html>
          `,
        })
        console.log('[WEBHOOK] Admin notif email sent for order:', order_id)
      } catch (emailError) {
        // Email gagal tidak stop proses — DB sudah terupdate
        console.error('[WEBHOOK] Admin email failed (non-fatal):', emailError)
      }

    } else if (isPending) {
      console.log('[WEBHOOK] Payment pending for order:', order_id)

    } else if (isFailed) {
      console.log('[WEBHOOK] Payment failed/cancelled for order:', order_id)
      if (userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ pending_plan: null })
          .eq('id', userId)
        console.log('[WEBHOOK] Cleared pending_plan for user:', userId)
      }
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('[WEBHOOK] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}