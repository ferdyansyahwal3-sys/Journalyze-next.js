import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyMidtransSignature } from '@/lib/midtrans'
import { Resend } from 'resend'

// Pakai service role key supaya bisa update tanpa RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ADMIN_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

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
      custom_field1: userId, // user ID yang kita simpan saat create transaction
      customer_details,
    } = body

    console.log('Midtrans webhook received:', { order_id, transaction_status, fraud_status })

    // 1. Verifikasi signature (keamanan - pastikan dari Midtrans asli)
    const isValid = verifyMidtransSignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    )

    if (!isValid) {
      console.error('Invalid Midtrans signature!')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // 2. Cek apakah pembayaran sukses
    const isSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement'

    const isPending = transaction_status === 'pending'
    const isFailed =
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'

    if (isSuccess) {
      // 3. Upgrade akun user ke premium
      const { data: profile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'premium',
          plan_activated_at: new Date().toISOString(),
          is_activated: true,
          activated_at: new Date().toISOString(),
          midtrans_order_id: order_id,
        })
        .eq('id', userId)
        .select('email, display_name')
        .single()

      if (updateError) {
        console.error('Failed to upgrade user:', updateError)
        return NextResponse.json({ error: 'Failed to upgrade user' }, { status: 500 })
      }

      console.log('User upgraded to premium:', userId)

      // 4. Kirim email konfirmasi via Resend
      const customerEmail = customer_details?.email || profile?.email
      const customerName = customer_details?.first_name || profile?.display_name || 'Trader'

      if (customerEmail) {
        try {
          await resend.emails.send({
            from: 'Journalyze <noreply@journalyze.my.id>',
            to: customerEmail,
            subject: '🎉 Selamat! Akun Journalyze Premium Kamu Sudah Aktif',
            html: `
              <!DOCTYPE html>
              <html>
              <body style="font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px; margin: 0;">
                <div style="max-width: 560px; margin: 0 auto; background: #111; border: 1px solid #222; border-radius: 16px; padding: 40px;">
                  
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #C9A84C; font-size: 28px; margin: 0 0 8px;">Journalyze</h1>
                    <p style="color: #666; margin: 0; font-size: 13px;">Trading Journal Premium</p>
                  </div>

                  <h2 style="color: #fff; font-size: 20px; margin: 0 0 16px;">
                    Hei ${customerName}! 👋
                  </h2>
                  
                  <p style="color: #aaa; line-height: 1.6; margin: 0 0 24px;">
                    Pembayaranmu berhasil dikonfirmasi! Akun <strong style="color: #C9A84C;">Journalyze Premium</strong> kamu sekarang sudah aktif.
                  </p>

                  <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #666; font-size: 12px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px;">Order ID</p>
                    <p style="color: #C9A84C; font-family: monospace; font-size: 14px; margin: 0;">${order_id}</p>
                  </div>

                  <p style="color: #aaa; line-height: 1.6; margin: 0 0 32px;">
                    Semua data tradingmu sekarang tersimpan aman di cloud. Mulai journal trading pertamamu sekarang!
                  </p>

                  <div style="text-align: center;">
                    <a href="https://journalyze.my.id/journal" 
                       style="display: inline-block; background: #C9A84C; color: #000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px;">
                      Buka Journalyze →
                    </a>
                  </div>

                  <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;">
                  
                  <p style="color: #444; font-size: 12px; text-align: center; margin: 0;">
                    Butuh bantuan? Reply email ini atau hubungi kami.<br>
                    © 2025 Journalyze. All rights reserved.
                  </p>
                </div>
              </body>
              </html>
            `,
          })
          console.log('Email sent to:', customerEmail)
        } catch (emailError) {
          // Email gagal tidak harus stop proses, akun sudah di-upgrade
          console.error('Email failed:', emailError)
        }
      }
    } else if (isPending) {
      console.log('Payment pending for order:', order_id)
      // Tidak perlu action khusus, tunggu settlement
    } else if (isFailed) {
      console.log('Payment failed/cancelled for order:', order_id)
      // Opsional: log ke tabel failed_transactions
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}