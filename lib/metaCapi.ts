// lib/metaCapi.ts
// SERVER ONLY — jangan di-import dari komponen 'use client'.
// Mengirim event ke Meta Conversions API. Token dibaca dari environment variable server:
//   META_CAPI_TOKEN_<PixelID>   (contoh: META_CAPI_TOKEN_1794423364856946)
import { createHash } from 'crypto'
import { _sb, _sbAdmin } from '@/lib/supabaseClient'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
export const SITE_URL = 'https://journalyze.my.id'

export interface CapiAnalytics {
  id: string
  name: string
  pixelId: string
  enabled: boolean
  testCode?: string
}

export interface CapiEventInput {
  eventName: string
  eventId: string
  sourceUrl: string
  userData: Record<string, unknown>
  customData?: Record<string, unknown>
}

export interface CapiResult {
  ok: boolean
  status: number
  eventsReceived?: number
  fbtraceId?: string
  error?: string
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export function getCapiToken(pixelId: string): string | null {
  if (!/^\d+$/.test(pixelId)) return null
  const t = process.env[`META_CAPI_TOKEN_${pixelId}`]
  return t && t.trim() ? t.trim() : null
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  return digits
}

async function loadSettings(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await _sb.from('settings').select('key, value').in('key', keys)
  const out: Record<string, string> = {}
  if (error || !data) return out
  for (const r of data as { key: string; value: string }[]) out[r.key] = r.value
  return out
}

/** Daftar analitik Meta Pixel (dengan migrasi dari pengaturan lama, sama seperti sisi publik). */
export async function loadServerAnalytics(): Promise<CapiAnalytics[]> {
  const s = await loadSettings(['pixel_id', 'pixel_enabled', 'pixel_analytics'])
  const raw = s['pixel_analytics']

  if (raw === undefined || raw === '') {
    const id = (s['pixel_id'] || '').trim()
    if (/^\d+$/.test(id)) {
      return [{ id: 'a_legacy', name: 'Meta Pixel', pixelId: id, enabled: s['pixel_enabled'] === 'true' }]
    }
    return []
  }

  try {
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const out: CapiAnalytics[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (o.type !== 'meta_pixel') continue
      const pixelId = typeof o.pixelId === 'string' ? o.pixelId.trim() : ''
      if (!/^\d+$/.test(pixelId)) continue
      out.push({
        id: typeof o.id === 'string' && o.id ? o.id : `a_${out.length}_${pixelId}`,
        name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Meta Pixel',
        pixelId,
        enabled: o.enabled !== false,
        ...(typeof o.testCode === 'string' && o.testCode.trim() ? { testCode: o.testCode.trim() } : {}),
      })
    }
    return out
  } catch {
    return []
  }
}

// Analitik tujuan Purchase dari server — mengikuti aturan "Pembayaran sukses → Purchase" di admin
async function purchaseTargets(analytics: CapiAnalytics[]): Promise<CapiAnalytics[]> {
  const active = analytics.filter((a) => a.enabled)
  const s = await loadSettings(['pixel_rules'])
  const raw = s['pixel_rules']
  if (raw === undefined || raw === '') return active // aturan awal: Purchase aktif untuk semua

  try {
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return active
    const ids = new Set<string>()
    let all = false
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (o.enabled === false || o.event !== 'Purchase' || o.trigger !== 'payment_success') continue
      if (Array.isArray(o.targets) && o.targets.length > 0) {
        for (const t of o.targets) if (typeof t === 'string') ids.add(t)
      } else {
        all = true
      }
    }
    if (all) return active
    return active.filter((a) => ids.has(a.id))
  } catch {
    return active
  }
}

export async function sendCapiEvent(
  pixelId: string,
  token: string,
  ev: CapiEventInput,
  testCode?: string
): Promise<CapiResult> {
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: ev.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: 'website',
        event_source_url: ev.sourceUrl,
        user_data: ev.userData,
        ...(ev.customData ? { custom_data: ev.customData } : {}),
      },
    ],
    access_token: token,
  }
  if (testCode) body.test_event_code = testCode

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const json = (await res.json().catch(() => ({}))) as {
      events_received?: number
      fbtrace_id?: string
      error?: { message?: string; fbtrace_id?: string }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        fbtraceId: json.error?.fbtrace_id,
        error: json.error?.message || `HTTP ${res.status}`,
      }
    }
    return { ok: true, status: res.status, eventsReceived: json.events_received, fbtraceId: json.fbtrace_id }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { ok: false, status: 0, error: aborted ? 'Timeout menghubungi Meta (6 detik)' : 'Gagal menghubungi Meta' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Purchase dari webhook Midtrans. event_id = order_id → dedup dengan Purchase di browser.
 * Tidak memakai Kode Testing (ini event produksi). Dipanggil non-fatal dari webhook.
 */
export async function sendPurchaseCapi(p: {
  orderId: string
  value: number
  email?: string
  phone?: string
  firstName?: string
  userId?: string
}): Promise<void> {
  const targets = await purchaseTargets(await loadServerAnalytics())
  if (targets.length === 0) return

  const { data: ctx } = await _sbAdmin
    .from('pixel_order_context')
    .select('user_agent, client_ip, fbp, fbc, source_url')
    .eq('order_id', p.orderId)
    .maybeSingle()

  if (!ctx?.user_agent) {
    // Event website wajib punya client_user_agent — lebih baik dilewati daripada dikirim tidak valid
    console.warn('[CAPI] Konteks browser order ini tidak ada, Purchase server dilewati:', p.orderId)
    return
  }

  const userData: Record<string, unknown> = { client_user_agent: ctx.user_agent }
  if (ctx.client_ip) userData.client_ip_address = ctx.client_ip
  if (ctx.fbp) userData.fbp = ctx.fbp
  if (ctx.fbc) userData.fbc = ctx.fbc
  if (p.email && p.email.includes('@')) userData.em = [sha256(p.email.trim().toLowerCase())]
  if (p.phone) {
    const ph = normalizePhone(p.phone)
    if (ph.length >= 9) userData.ph = [sha256(ph)]
  }
  const fn = (p.firstName || '').trim().split(/\s+/)[0]?.toLowerCase()
  if (fn) userData.fn = [sha256(fn)]
  if (p.userId) userData.external_id = [sha256(p.userId)]

  for (const a of targets) {
    const token = getCapiToken(a.pixelId)
    if (!token) {
      console.log(`[CAPI] ${a.name}: token belum diatur, dilewati`)
      continue
    }
    const r = await sendCapiEvent(a.pixelId, token, {
      eventName: 'Purchase',
      eventId: p.orderId,
      sourceUrl: ctx.source_url || `${SITE_URL}/`,
      userData,
      customData: { value: p.value, currency: 'IDR' },
    })
    if (r.ok) {
      console.log(`[CAPI] Purchase terkirim ke ${a.name} (diterima: ${r.eventsReceived}, trace: ${r.fbtraceId})`)
    } else {
      console.warn(`[CAPI] Purchase gagal ke ${a.name}: ${r.error}`)
    }
  }
}
