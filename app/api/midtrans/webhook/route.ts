// app/api/midtrans/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import { verifyMidtransSignature } from '@/lib/midtrans'
import { Resend } from 'resend'
import { sendPurchaseCapi } from '@/lib/metaCapi'
import { ensureAccountKey } from '@/lib/accountKey'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

// Format & alfabet sama persis dengan genKeyString() di lib/adminHelpers.ts,
// tapi memakai crypto.randomInt (server-side, aman secara kriptografi).
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genLicenseKey(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () => KEY_CHARS[randomInt(KEY_CHARS.length)]).join('')
  return `JZ-${seg(4)}-${seg(4)}`
}

// Escape input user sebelum masuk ke template HTML email
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
      custom_field3: rawField3,
      customer_details,
    } = body

    // rawField3 bisa "paketKey" atau "paketKey|affiliateCode"
    const [planKeyFromOrder, affiliateCodeFromOrder] = (rawField3 ?? "").split("|")

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

    if (!isValid) {
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

      // ── Idempotency: order ini sudah pernah diproses? ──
      // Midtrans bisa kirim notifikasi berkali-kali untuk order yang sama.
      const { data: existingKey, error: existingErr } = await supabaseAdmin
        .from('license_keys')
        .select('key')
        .eq('order_id', order_id)
        .maybeSingle()

      if (existingErr) {
        console.warn('[WEBHOOK] Idempotency check skipped:', existingErr.message)
      }
      if (existingKey) {
        console.log('[WEBHOOK] Order already processed, skipping:', order_id)
        return NextResponse.json({ status: 'ok', note: 'already processed' })
      }

      // Basic = 90 hari, Pro & Elite = lifetime (null)
      const planExpiresAt =
        paketKey === 'basic'
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          : null

      // Langsung aktivasi — admin_verified = true otomatis
      const { data: profile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          plan:              paketKey,
          plan_type:         paketKey,
          admin_verified:    true,
          pending_plan:      null,
          is_activated:      true,
          plan_activated_at: new Date().toISOString(),
          plan_expires_at:   planExpiresAt,
          midtrans_order_id: order_id,
          trial_used:        true,
        })
        .eq('id', userId)
        .select('email, display_name')
        .single()

      if (updateError) {
        console.error('[WEBHOOK] Supabase update error:', updateError)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      console.log('[WEBHOOK] ✅ Profile activated successfully:', profile)

      const customerName  = customer_details?.first_name || profile?.display_name || 'Trader'
      const customerEmail = customer_details?.email || profile?.email || '-'

      // ── Catat transaksi untuk dashboard admin (non-fatal) ──
      try {
        const { data: leadRows } = await supabaseAdmin
          .from('leads')
          .select('promo_code')
          .eq('midtrans_order_id', order_id)
          .limit(1)
        await supabaseAdmin.from('transactions').upsert(
          {
            order_id,
            paid_at:        new Date().toISOString(),
            buyer_email:    customerEmail !== '-' ? customerEmail : null,
            plan_type:      paketKey,
            gross_amount:   Math.round(parseFloat(gross_amount ?? '0')) || 0,
            promo_code:     leadRows?.[0]?.promo_code ?? null,
            affiliate_code: affiliateCodeFromOrder ? String(affiliateCodeFromOrder).toLowerCase() : null,
            is_estimate:    false,
          },
          { onConflict: 'order_id' }
        )
      } catch (txErr) {
        console.warn('[WEBHOOK] Transaction log failed (non-fatal):', txErr)
      }

      // ── STEP 1: Kode akun (license key) ──
      // Akun baru sudah punya kode sejak daftar. Di sini kode itu ditandai order ini
      // (order_id + paket_key) agar idempotency tetap jalan.
      // Gagal TIDAK menghentikan proses (plan sudah aktif).
      let licenseKey: string | null = null
      let duplicateOrder = false
      const nowIso = new Date().toISOString()

      // (a) Tandai kode akun yang sudah ada — atomik, hanya kalau belum ditandai order lain
      const accountKey = await ensureAccountKey(userId, customerName)
      if (accountKey) {
        const { data: claimed, error: claimErr } = await supabaseAdmin
          .from('license_keys')
          .update({ order_id, paket_key: paketKey, auto_generated: true })
          .eq('key', accountKey)
          .is('order_id', null)
          .select('key')

        if (claimErr) {
          console.warn('[WEBHOOK] Account key claim failed (non-fatal):', claimErr.message)
        } else if (claimed && claimed.length > 0) {
          licenseKey = accountKey
          console.log('[WEBHOOK] Account key marked for order:', order_id)
        } else {
          // 0 baris: webhook paralel sudah memproses order ini, atau ini pembelian ke-2
          const { data: dup } = await supabaseAdmin
            .from('license_keys')
            .select('key')
            .eq('order_id', order_id)
            .maybeSingle()
          if (dup) duplicateOrder = true
        }
      }

      // (b) Cadangan: baris baru khusus order ini (pembelian ke-2 / kode akun gagal dibuat)
      if (!licenseKey && !duplicateOrder) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const candidate = genLicenseKey()
          const { error: keyError } = await supabaseAdmin.from('license_keys').insert({
            key:            candidate,
            is_used:        true,
            is_revoked:     false,
            customer_name:  customerName,
            used_by:        userId,
            used_at:        nowIso,
            created_at:     nowIso,
            paket_key:      paketKey,
            auto_generated: true,
            order_id:       order_id,
          })

          if (!keyError) {
            licenseKey = candidate
            console.log('[WEBHOOK] License key generated for order:', order_id)
            break
          }

          if (keyError.code === '23505') {
            const { data: dup } = await supabaseAdmin
              .from('license_keys')
              .select('key')
              .eq('order_id', order_id)
              .maybeSingle()
            if (dup) {
              duplicateOrder = true
              break
            }
            continue // tabrakan key → generate ulang
          }

          console.warn('[WEBHOOK] License key insert failed (non-fatal):', keyError.message)
          break
        }
      }

      if (duplicateOrder) {
        console.log('[WEBHOOK] Parallel webhook already handled order, stopping:', order_id)
        return NextResponse.json({ status: 'ok', note: 'already processed' })
      }

      if (!licenseKey) {
        console.warn('[WEBHOOK] No license key generated for order:', order_id)
      }

      // ── Meta Conversions API: Purchase dari server (dedup dengan browser: event_id = order_id) ──
      // Gagal TIDAK menghentikan proses (plan sudah aktif).
      try {
        await sendPurchaseCapi({
          orderId: order_id,
          value: parseFloat(gross_amount ?? '0') || 0,
          email: customerEmail,
          phone: customer_details?.phone,
          firstName: customerName,
          userId,
        })
      } catch (capiError) {
        console.warn('[WEBHOOK] Meta CAPI failed (non-fatal):', capiError)
      }

      // ── Notifikasi admin via email ──
      const adminLink = `${ADMIN_PANEL_URL}?tab=users&search=${encodeURIComponent(customerEmail)}`

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
                <p style="color: #666; margin: 0 0 32px; font-size: 13px;">Notifikasi AktivasiOtomatis</p>

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
                      <td style="color: #22c55e; font-size: 12px; font-weight: 700;">✅ SUKSES— Diaktifkan Otomatis</td>
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

      // ── STEP 3: Email konfirmasi ke USER (try-catch terpisah) ──
      if (customerEmail.includes('@')) {
        try {
          const safeName   = escapeHtml(String(customerName))
          const safeOrder  = escapeHtml(String(order_id))
          const paketLabel = paketKey.toUpperCase()

          const keyRow = licenseKey
            ? `
        <tr>
          <td style="color: #666; font-size: 12px; padding: 6px 0;">Kode Akun</td>
          <td style="color: #C9A84C; font-size: 16px; font-weight: 700; font-family: monospace; letter-spacing: 3px;">${licenseKey}</td>
        </tr>`
            : ''

          await resend.emails.send({
            from: 'Journalyze Webhook <noreply@journalyze.my.id>',
            to: customerEmail,
            subject: `✅ Pembayaran Berhasil — Journalyze ${paketLabel}`,
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #111; border: 1px solid #333; border-radius: 16px; padding: 40px;">

    <h1 style="color: #C9A84C; margin: 0 0 8px; font-size: 22px;">Journalyze</h1>
    <p style="color: #666; margin: 0 0 32px; font-size: 13px;">Konfirmasi Pembayaran</p>

    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Halo <strong style="color: #fff;">${safeName}</strong>,<br><br>
      Pembayaran kamu sudah kami terima. Akun Journalyze kamu sudah aktif.
    </p>

    <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; font-size: 12px; padding: 6px 0; width: 40%;">Paket</td>
          <td style="color: #C9A84C; font-size: 13px; font-weight: 700; font-family: monospace;">${paketLabel}</td>
        </tr>
        <tr>
          <td style="color: #666; font-size: 12px; padding: 6px 0;">Order ID</td>
          <td style="color: #aaa; font-size: 12px; font-family: monospace;">${safeOrder}</td>
        </tr>
        <tr>
          <td style="color: #666; font-size: 12px; padding: 6px 0;">Nominal</td>
          <td style="color: #fff; font-size: 13px;">Rp ${parseInt(gross_amount ?? '0', 10).toLocaleString('id-ID')}</td>
        </tr>
        <tr>
          <td style="color: #666; font-size: 12px; padding: 6px 0;">Akses</td>
          <td style="color: #fff; font-size: 13px;">${paketKey === 'basic' ? '3 Bulan' : 'Selamanya (Lifetime)'}</td>
        </tr>${keyRow}
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://journalyze.my.id/journal"
         style="display: inline-block; background: #C9A84C; color: #000; text-decoration: none;
                padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">
        Buka Journalyze →
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;">
    <p style="color: #444; font-size: 11px; text-align: center; margin: 0;">
      © ${new Date().getFullYear()} Journalyze · <a href="https://wa.me/6281311973602" style="color: #666;">Bantuan via WhatsApp</a>
    </p>
  </div>
</body>
</html>
            `,
          })
          console.log('[WEBHOOK] User confirmation email sent for order:', order_id)
        } catch (userEmailError) {
          // Email user gagal tidak stop proses
          console.warn('[WEBHOOK] User email failed (non-fatal):', userEmailError)
        }
      } else {
        console.warn('[WEBHOOK] No valid user email, skipping confirmation email for order:', order_id)
      }

    // ── Affiliate tracking (non-fatal) ──
      if (affiliateCodeFromOrder) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://journalyze.my.id"
          await fetch(`${baseUrl}/api/affiliate/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id,
              buyer_email: customerEmail,
              buyer_name:  customerName,
              plan_type:   paketKey,
              affiliate_code: affiliateCodeFromOrder,
            }),
          })
        } catch (affErr) {
          console.warn("[WEBHOOK] Affiliate track failed (non-fatal):", affErr)
        }
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
