// lib/activatePlan.ts
// SERVER ONLY — jangan di-import dari komponen 'use client'.
//
// Logika aktivasi paket setelah pembayaran Midtrans. Dipakai oleh:
//   1. app/api/midtrans/webhook/route.ts  (notifikasi dari Midtrans)
//   2. app/api/midtrans/verify/route.ts   (cek status langsung ke Midtrans setelah user selesai bayar)
// Idempotent: aman dipanggil berkali-kali / paralel untuk order yang sama.
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import { Resend } from 'resend'
import { sendPurchaseCapi } from '@/lib/metaCapi'
import { ensureAccountKey } from '@/lib/accountKey'
import { recordAffiliateReferral } from '@/lib/affiliateReferral'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

const ADMIN_EMAIL = 'journalyze3@gmail.com'
const ADMIN_PANEL_URL = 'https://journalyze.my.id/admin'

export interface MidtransPayload {
  order_id: string
  gross_amount?: string
  transaction_status?: string
  fraud_status?: string
  custom_field1?: string // userId
  custom_field2?: string // userEmail
  custom_field3?: string // "paketKey" atau "paketKey|affiliateCode"
  customer_details?: {
    first_name?: string
    email?: string
    phone?: string
  }
}

export type ActivateResult =
  | { status: 'activated'; paketKey: string }
  | { status: 'already_processed'; paketKey: string }
  | { status: 'not_paid' }
  | { status: 'missing_user' }
  | { status: 'db_error'; error: string }

// Status Midtrans yang artinya uang sudah masuk
export function isPaidStatus(transactionStatus?: string, fraudStatus?: string): boolean {
  return (
    (transactionStatus === 'capture' && fraudStatus === 'accept') ||
    transactionStatus === 'settlement'
  )
}

// Map harga Midtrans → plan_type key (fallback jika custom_field3 kosong)
function resolvePlanKey(grossAmount: string): string {
  const amount = parseInt(grossAmount, 10)
  if (amount <= 100000) return 'basic'
  if (amount <= 200000) return 'pro'
  return 'elite'
}

// Format & alfabet sama persis dengan genKeyString() di lib/adminHelpers.ts
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genLicenseKey(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () => KEY_CHARS[randomInt(KEY_CHARS.length)]).join('')
  return `JZ-${seg(4)}-${seg(4)}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function activatePlan(p: MidtransPayload): Promise<ActivateResult> {
  const { order_id, gross_amount, transaction_status, fraud_status, customer_details } = p

  if (!isPaidStatus(transaction_status, fraud_status)) {
    return { status: 'not_paid' }
  }

  // rawField3 bisa "paketKey" atau "paketKey|affiliateCode"
  const [planKeyFromOrder, affiliateCodeFromOrder] = (p.custom_field3 ?? '').split('|')

  // ── Cari userId: dari custom_field1, fallback lewat profiles.midtrans_order_id ──
  let userId = p.custom_field1 || ''
  if (!userId) {
    const { data: byOrder } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('midtrans_order_id', order_id)
      .maybeSingle()
    userId = byOrder?.id || ''
  }
  if (!userId) {
    console.error('[ACTIVATE] userId tidak ditemukan untuk order:', order_id)
    return { status: 'missing_user' }
  }

  const paketKey = planKeyFromOrder || resolvePlanKey(gross_amount ?? '0')
  console.log('[ACTIVATE] Activating plan:', paketKey, 'for userId:', userId, 'order:', order_id)

  // ── Idempotency: order ini sudah pernah diproses? ──
  const { data: existingKey, error: existingErr } = await supabaseAdmin
    .from('license_keys')
    .select('key')
    .eq('order_id', order_id)
    .maybeSingle()

  if (existingErr) {
    console.warn('[ACTIVATE] Idempotency check skipped:', existingErr.message)
  }
  if (existingKey) {
    console.log('[ACTIVATE] Order already processed, skipping:', order_id)
    return { status: 'already_processed', paketKey }
  }

  // Basic = 90 hari, Pro & Elite = lifetime (null)
  const planExpiresAt =
    paketKey === 'basic'
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : null

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
    console.error('[ACTIVATE] Supabase update error:', updateError)
    return { status: 'db_error', error: updateError.message }
  }

  console.log('[ACTIVATE] ✅ Profile activated:', profile)

  const customerName  = customer_details?.first_name || profile?.display_name || 'Trader'
  const customerEmail = customer_details?.email || profile?.email || '-'

  // Sandbox: jangan cemari data asli (dashboard, Pixel, email admin, afiliasi)
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  if (!isProd) console.log('[ACTIVATE] Mode sandbox: transaksi/CAPI/email admin/afiliasi dilewati')

  // ── Catat transaksi untuk dashboard admin (non-fatal) ──
  if (isProd) try {
    const { data: leadRows } = await supabaseAdmin
      .from('leads')
      .select('promo_code')
      .eq('midtrans_order_id', order_id)
      .limit(1)
    const { error: txUpsertErr } = await supabaseAdmin.from('transactions').upsert(
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
    if (txUpsertErr) {
      console.warn('[ACTIVATE] Transaction log failed (non-fatal):', {
        order_id,
        code: txUpsertErr.code,
        message: txUpsertErr.message,
      })
    } else {
      console.log('[ACTIVATE] Transaction logged for order:', order_id)
    }
  } catch (txErr) {
    console.warn('[ACTIVATE] Transaction log failed (non-fatal):', txErr)
  }

  // ── Kode akun (license key): tandai dengan order ini ──
  let licenseKey: string | null = null
  let duplicateOrder = false
  const nowIso = new Date().toISOString()

  const accountKey = await ensureAccountKey(userId, customerName)
  if (accountKey) {
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('license_keys')
      .update({ order_id, paket_key: paketKey, auto_generated: true })
      .eq('key', accountKey)
      .is('order_id', null)
      .select('key')

    if (claimErr) {
      console.warn('[ACTIVATE] Account key claim failed (non-fatal):', claimErr.message)
    } else if (claimed && claimed.length > 0) {
      licenseKey = accountKey
      console.log('[ACTIVATE] Account key marked for order:', order_id)
    } else {
      // 0 baris: proses paralel sudah menangani order ini, atau ini pembelian ke-2
      const { data: dup } = await supabaseAdmin
        .from('license_keys')
        .select('key')
        .eq('order_id', order_id)
        .maybeSingle()
      if (dup) duplicateOrder = true
    }
  }

  // Cadangan: baris baru khusus order ini (pembelian ke-2 / kode akun gagal dibuat)
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
        console.log('[ACTIVATE] License key generated for order:', order_id)
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

      console.warn('[ACTIVATE] License key insert failed (non-fatal):', keyError.message)
      break
    }
  }

  if (duplicateOrder) {
    // Proses paralel (webhook / verify) sudah mengurus email, CAPI, afiliasi.
    console.log('[ACTIVATE] Parallel process already handled order, stopping:', order_id)
    return { status: 'already_processed', paketKey }
  }

  if (!licenseKey) {
    console.warn('[ACTIVATE] No license key generated for order:', order_id)
  }

  // ── Meta Conversions API (non-fatal) ──
  if (isProd) try {
    await sendPurchaseCapi({
      orderId: order_id,
      value: parseFloat(gross_amount ?? '0') || 0,
      email: customerEmail,
      phone: customer_details?.phone,
      firstName: customerName,
      userId,
    })
  } catch (capiError) {
    console.warn('[ACTIVATE] Meta CAPI failed (non-fatal):', capiError)
  }

  // ── Email ke admin (non-fatal) ──
  if (isProd) try {
    const adminLink = `${ADMIN_PANEL_URL}?tab=users&search=${encodeURIComponent(customerEmail)}`
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
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0; width: 40%;">User</td><td style="color: #fff; font-size: 13px; font-weight: 600;">${escapeHtml(String(customerName))}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Email</td><td style="color: #fff; font-size: 13px;">${escapeHtml(String(customerEmail))}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Paket</td><td style="color: #C9A84C; font-size: 13px; font-weight: 700; font-family: monospace;">${paketKey.toUpperCase()}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Order ID</td><td style="color: #aaa; font-size: 12px; font-family: monospace;">${escapeHtml(String(order_id))}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Nominal</td><td style="color: #fff; font-size: 13px;">Rp ${parseInt(gross_amount ?? '0', 10).toLocaleString('id-ID')}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Status</td><td style="color: #22c55e; font-size: 12px; font-weight: 700;">✅ SUKSES — Diaktifkan Otomatis</td></tr>
      </table>
    </div>
    <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      Akun user ini sudah <strong style="color: #22c55e;">PREMIUM</strong> dan diaktifkan otomatis.
    </p>
    <div style="text-align: center;">
      <a href="${adminLink}" style="display: inline-block; background: #C9A84C; color: #000; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">Lihat di Admin Panel →</a>
    </div>
    <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;">
    <p style="color: #444; font-size: 11px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Journalyze Admin Panel</p>
  </div>
</body>
</html>`,
    })
    console.log('[ACTIVATE] Admin notif email sent for order:', order_id)
  } catch (emailError) {
    console.error('[ACTIVATE] Admin email failed (non-fatal):', emailError)
  }

  // ── Email konfirmasi ke user (non-fatal) ──
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
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0; width: 40%;">Paket</td><td style="color: #C9A84C; font-size: 13px; font-weight: 700; font-family: monospace;">${paketLabel}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Order ID</td><td style="color: #aaa; font-size: 12px; font-family: monospace;">${safeOrder}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Nominal</td><td style="color: #fff; font-size: 13px;">Rp ${parseInt(gross_amount ?? '0', 10).toLocaleString('id-ID')}</td></tr>
        <tr><td style="color: #666; font-size: 12px; padding: 6px 0;">Akses</td><td style="color: #fff; font-size: 13px;">${paketKey === 'basic' ? '3 Bulan' : 'Selamanya (Lifetime)'}</td></tr>${keyRow}
      </table>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://journalyze.my.id/journal" style="display: inline-block; background: #C9A84C; color: #000; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">Buka Journalyze →</a>
    </div>
    <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;">
    <p style="color: #444; font-size: 11px; text-align: center; margin: 0;">
      © ${new Date().getFullYear()} Journalyze · <a href="https://wa.me/6281311973602" style="color: #666;">Bantuan via WhatsApp</a>
    </p>
  </div>
</body>
</html>`,
      })
      console.log('[ACTIVATE] User confirmation email sent for order:', order_id)
    } catch (userEmailError) {
      console.warn('[ACTIVATE] User email failed (non-fatal):', userEmailError)
    }
  } else {
    console.warn('[ACTIVATE] No valid user email, skipping confirmation email for order:', order_id)
  }

  // ── Affiliate tracking (non-fatal) ──
  if (isProd && affiliateCodeFromOrder) {
    try {
      const result = await recordAffiliateReferral(supabaseAdmin, {
        orderId:       order_id,
        buyerEmail:    customerEmail,
        buyerName:     customerName,
        planType:      paketKey,
        affiliateCode: String(affiliateCodeFromOrder),
      })
      if (!result.ok) {
        console.error('[ACTIVATE] Affiliate referral TIDAK tercatat:', {
          order_id, affiliateCode: affiliateCodeFromOrder, ...result,
        })
      }
    } catch (affErr) {
      console.error('[ACTIVATE] Affiliate referral error (non-fatal):', affErr)
    }
  }

  return { status: 'activated', paketKey }
}

// Dipanggil saat pembayaran dibatalkan / ditolak / kedaluwarsa
export async function clearPendingPlan(userId: string): Promise<void> {
  await supabaseAdmin.from('profiles').update({ pending_plan: null }).eq('id', userId)
  console.log('[ACTIVATE] Cleared pending_plan for user:', userId)
}
