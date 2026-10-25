// app/api/pixel/insights/route.ts
// Admin-only. Mengambil angka iklan ASLI dari Meta Marketing API (Ads Insights).
// Token Meta HANYA dibaca dari environment variable server — tidak pernah dikirim ke klien,
// tidak disimpan di Supabase/localStorage/repo.
//
// Dua mode:
//   ?view=overview (default)
//        &campaign=ID &adset=ID &ad=ID   (opsional, yang paling spesifik dipakai)
//        → total, harian, daftar baris satu tingkat di bawah pilihan, rincian
//   ?view=children&parent=ID&level=adset|ad → turunan satu kampanye (adset) atau satu adset (iklan)
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = 'https://graph.facebook.com'
const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_RANGE_DAYS = 93
const MAX_PAGES = 5

// Jenis aksi — hanya SATU per metrik yang dipakai (urutan prioritas), TIDAK dijumlahkan,
// supaya tidak terhitung ganda (Meta mengirim beberapa varian dengan angka yang sama).
// CATATAN: nama jenis aksi ini perlu dicek ulang dengan data iklan sungguhan.
const LINK_CLICK_TYPES = ['link_click']
const LPV_TYPES = ['landing_page_view']
const ADD_TO_CART_TYPES = ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart']
const CHECKOUT_TYPES = ['omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'initiate_checkout']
const PURCHASE_TYPES = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase']

const METRIC_FIELDS = 'spend,impressions,reach,actions,action_values'

type ScopeLevel = 'account' | 'campaign' | 'adset' | 'ad'
type RowLevel = 'campaign' | 'adset' | 'ad'

const ROW_FIELDS: Record<RowLevel, string> = {
  campaign: 'campaign_id,campaign_name',
  adset: 'adset_id,adset_name',
  ad: 'ad_id,ad_name',
}

interface ActionItem { action_type: string; value: string }

interface RawRow {
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  date_start?: string
  date_stop?: string
  publisher_platform?: string
  platform_position?: string
  age?: string
  gender?: string
  device_platform?: string
  spend?: string
  impressions?: string
  reach?: string
  actions?: ActionItem[]
  action_values?: ActionItem[]
}

export interface Metrics {
  spend: number
  impressions: number
  reach: number
  frequency: number            // impressions / reach
  cpm: number | null           // spend / impressions × 1000
  linkClicks: number
  ctr: number                  // persen, klik link / impressions
  cpc: number | null           // spend / klik link
  landingPageViews: number
  addToCart: number
  initiateCheckout: number
  purchases: number
  purchaseValue: number
  costPerPurchase: number | null
  roas: number | null          // nilai pembelian / spend
}

export interface NamedRow extends Metrics { id: string; name: string }
export interface LabelRow extends Metrics { label: string }
export interface DailyRow extends Metrics { date: string }

interface Breakdowns {
  platform: LabelRow[]
  placement: LabelRow[]
  age: LabelRow[]
  gender: LabelRow[]
  device: LabelRow[]
}

interface OverviewPayload {
  configured: true
  view: 'overview'
  range: { from: string; to: string }
  fetchedAt: number
  scope: { level: ScopeLevel; id: string }
  rowLevel: RowLevel
  totals: Metrics
  daily: DailyRow[]
  rows: NamedRow[]
  breakdowns: Breakdowns
  breakdownError?: string
}

interface ChildrenPayload {
  configured: true
  view: 'children'
  range: { from: string; to: string }
  fetchedAt: number
  parentId: string
  level: 'adset' | 'ad'
  rows: NamedRow[]
}

type Payload = OverviewPayload | ChildrenPayload

const cache = new Map<string, { at: number; payload: Payload }>()

function num(v: unknown): number {
  const n = typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

function pickAction(list: ActionItem[] | undefined, types: string[]): number {
  if (!Array.isArray(list)) return 0
  for (const t of types) {
    const found = list.find((a) => a.action_type === t)
    if (found) return num(found.value)
  }
  return 0
}

function toMetrics(r: RawRow | undefined): Metrics {
  const spend = num(r?.spend)
  const impressions = num(r?.impressions)
  const reach = num(r?.reach)
  const linkClicks = pickAction(r?.actions, LINK_CLICK_TYPES)
  const purchases = pickAction(r?.actions, PURCHASE_TYPES)
  const purchaseValue = pickAction(r?.action_values, PURCHASE_TYPES)
  return {
    spend,
    impressions,
    reach,
    frequency: reach > 0 ? impressions / reach : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    linkClicks,
    ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    cpc: linkClicks > 0 ? spend / linkClicks : null,
    landingPageViews: pickAction(r?.actions, LPV_TYPES),
    addToCart: pickAction(r?.actions, ADD_TO_CART_TYPES),
    initiateCheckout: pickAction(r?.actions, CHECKOUT_TYPES),
    purchases,
    purchaseValue,
    costPerPurchase: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
  }
}

function rowIdName(r: RawRow, level: RowLevel): { id: string; name: string } {
  if (level === 'campaign') return { id: r.campaign_id || '', name: r.campaign_name || '(tanpa nama)' }
  if (level === 'adset') return { id: r.adset_id || '', name: r.adset_name || '(tanpa nama)' }
  return { id: r.ad_id || '', name: r.ad_name || '(tanpa nama)' }
}

function toNamedRows(rows: RawRow[], level: RowLevel): NamedRow[] {
  return rows
    .map((r) => ({ ...rowIdName(r, level), ...toMetrics(r) }))
    .sort((a, b) => b.spend - a.spend)
}

// ── Penggabungan baris (mis. umur × gender → umur saja) ──
function sumActions(a?: ActionItem[], b?: ActionItem[]): ActionItem[] {
  const m = new Map<string, number>()
  for (const list of [a, b]) {
    for (const it of list ?? []) m.set(it.action_type, (m.get(it.action_type) ?? 0) + num(it.value))
  }
  return Array.from(m.entries()).map(([action_type, v]) => ({ action_type, value: String(v) }))
}

function toLabelRows(rows: RawRow[], keyOf: (r: RawRow) => string): LabelRow[] {
  const merged = new Map<string, RawRow>()
  for (const r of rows) {
    const k = keyOf(r)
    const cur = merged.get(k)
    if (!cur) {
      merged.set(k, { ...r })
      continue
    }
    merged.set(k, {
      ...cur,
      spend: String(num(cur.spend) + num(r.spend)),
      impressions: String(num(cur.impressions) + num(r.impressions)),
      reach: String(num(cur.reach) + num(r.reach)),
      actions: sumActions(cur.actions, r.actions),
      action_values: sumActions(cur.action_values, r.action_values),
    })
  }
  return Array.from(merged.entries())
    .map(([label, r]) => ({ label, ...toMetrics(r) }))
    .sort((a, b) => b.spend - a.spend)
}

function parseDay(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null
  return d
}

type FetchResult = { rows: RawRow[] } | { error: string }

async function fetchInsights(
  objectId: string,
  token: string,
  params: Record<string, string>
): Promise<FetchResult> {
  const rows: RawRow[] = []
  const first = new URLSearchParams({ ...params, limit: '200', access_token: token })
  let url: string | null = `${GRAPH_BASE}/${GRAPH_VERSION}/${objectId}/insights?${first.toString()}`

  for (let page = 0; page < MAX_PAGES && url; page++) {
    let res: Response
    try {
      res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    } catch {
      return { error: 'Tidak bisa menghubungi Meta (timeout atau jaringan). Coba lagi sebentar.' }
    }

    let json: {
      data?: RawRow[]
      paging?: { next?: string }
      error?: { message?: string; code?: number }
    }
    try {
      json = await res.json()
    } catch {
      return { error: `Respons Meta tidak bisa dibaca (HTTP ${res.status}).` }
    }

    if (!res.ok || json.error) {
      const code = json.error?.code
      if (code === 190) {
        return { error: 'Token Meta tidak valid atau sudah kedaluwarsa (kode 190). Buat token baru lalu perbarui di Vercel.' }
      }
      const msg = json.error?.message || `HTTP ${res.status}`
      return { error: `Meta menolak permintaan${code ? ` (kode ${code})` : ''}: ${msg}` }
    }

    if (Array.isArray(json.data)) rows.push(...json.data)

    // Hanya ikuti halaman berikutnya bila tetap ke domain Graph API
    const next = json.paging?.next
    url = next && next.startsWith(`${GRAPH_BASE}/`) ? next : null
  }

  return { rows }
}

function rowsOf(r: FetchResult): RawRow[] {
  return 'rows' in r ? r.rows : []
}

function putCache(key: string, payload: Payload) {
  if (cache.size >= 80) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), payload })
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  // ── Cek konfigurasi (token TIDAK pernah dikembalikan, hanya status) ──
  const token = (process.env.META_ADS_ACCESS_TOKEN || '').trim()
  let account = (process.env.META_AD_ACCOUNT_ID || '').trim()
  if (/^\d+$/.test(account)) account = `act_${account}`

  const missing: string[] = []
  if (!token) missing.push('META_ADS_ACCESS_TOKEN')
  if (!account) missing.push('META_AD_ACCOUNT_ID')
  const invalid: string[] = []
  if (account && !/^act_\d+$/.test(account)) invalid.push('META_AD_ACCOUNT_ID')

  if (missing.length > 0 || invalid.length > 0) {
    return NextResponse.json({ configured: false, missing, invalid })
  }

  // ── Validasi rentang tanggal ──
  const sp = req.nextUrl.searchParams
  const fromStr = sp.get('from')
  const toStr = sp.get('to')
  const from = parseDay(fromStr)
  const to = parseDay(toStr)
  if (!from || !to || !fromStr || !toStr) {
    return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD (parameter from & to).' }, { status: 400 })
  }
  if (from.getTime() > to.getTime()) {
    return NextResponse.json({ error: 'Tanggal "dari" tidak boleh setelah tanggal "sampai".' }, { status: 400 })
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  if (days > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Rentang maksimal ${MAX_RANGE_DAYS} hari.` }, { status: 400 })
  }

  const time_range = JSON.stringify({ since: fromStr, until: toStr })
  const range = { from: fromStr, to: toStr }

  // ════════════ MODE: children (adset / iklan, untuk buka-tutup baris tabel) ════════════
  if (sp.get('view') === 'children') {
    const parent = sp.get('parent') || ''
    const level = sp.get('level')
    if (!/^\d+$/.test(parent)) {
      return NextResponse.json({ error: 'Parameter parent tidak valid.' }, { status: 400 })
    }
    if (level !== 'adset' && level !== 'ad') {
      return NextResponse.json({ error: 'Parameter level harus adset atau ad.' }, { status: 400 })
    }

    const key = `${account}|children|${parent}|${level}|${fromStr}|${toStr}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json({ ...hit.payload, cached: true })
    }

    const res = await fetchInsights(parent, token, {
      level,
      time_range,
      fields: `${ROW_FIELDS[level]},${METRIC_FIELDS}`,
    })
    if ('error' in res) {
      return NextResponse.json({ configured: true, error: res.error }, { status: 502 })
    }

    const payload: ChildrenPayload = {
      configured: true,
      view: 'children',
      range,
      fetchedAt: Date.now(),
      parentId: parent,
      level,
      rows: toNamedRows(res.rows, level),
    }
    putCache(key, payload)
    return NextResponse.json({ ...payload, cached: false })
  }

  // ════════════ MODE: overview (dengan filter campaign / adset / iklan) ════════════
  const campaignId = sp.get('campaign') || ''
  const adsetId = sp.get('adset') || ''
  const adId = sp.get('ad') || ''
  for (const v of [campaignId, adsetId, adId]) {
    if (v && !/^\d+$/.test(v)) {
      return NextResponse.json({ error: 'Parameter filter tidak valid.' }, { status: 400 })
    }
  }

  // Yang paling spesifik menang: iklan > ad set > campaign > seluruh akun
  const scope: { level: ScopeLevel; id: string } = adId
    ? { level: 'ad', id: adId }
    : adsetId
      ? { level: 'adset', id: adsetId }
      : campaignId
        ? { level: 'campaign', id: campaignId }
        : { level: 'account', id: account }
  const rowLevel: RowLevel =
    scope.level === 'account' ? 'campaign' : scope.level === 'campaign' ? 'adset' : 'ad'

  const cacheKey = `${account}|overview|${scope.level}:${scope.id}|${fromStr}|${toStr}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  const base = { time_range, fields: METRIC_FIELDS }
  const lvl = scope.level

  const [summary, daily, listing, platform, placement, ageGender, device] = await Promise.all([
    fetchInsights(scope.id, token, { level: lvl, ...base }),
    fetchInsights(scope.id, token, { level: lvl, ...base, time_increment: '1' }),
    fetchInsights(scope.id, token, { level: rowLevel, time_range, fields: `${ROW_FIELDS[rowLevel]},${METRIC_FIELDS}` }),
    fetchInsights(scope.id, token, { level: lvl, ...base, breakdowns: 'publisher_platform' }),
    fetchInsights(scope.id, token, { level: lvl, ...base, breakdowns: 'publisher_platform,platform_position' }),
    fetchInsights(scope.id, token, { level: lvl, ...base, breakdowns: 'age,gender' }),
    fetchInsights(scope.id, token, { level: lvl, ...base, breakdowns: 'device_platform' }),
  ])

  // Tiga panggilan inti harus berhasil
  for (const r of [summary, daily, listing]) {
    if ('error' in r) {
      return NextResponse.json({ configured: true, error: r.error }, { status: 502 })
    }
  }
  // Rincian opsional: kalau gagal, halaman utama tetap tampil
  let breakdownError: string | undefined
  for (const r of [platform, placement, ageGender, device]) {
    if ('error' in r) {
      breakdownError = r.error
      break
    }
  }

  const ag = rowsOf(ageGender)
  const payload: OverviewPayload = {
    configured: true,
    view: 'overview',
    range,
    fetchedAt: Date.now(),
    scope,
    rowLevel,
    totals: toMetrics(rowsOf(summary)[0]),
    daily: rowsOf(daily)
      .filter((r) => !!r.date_start)
      .map((r) => ({ date: r.date_start as string, ...toMetrics(r) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    rows: toNamedRows(rowsOf(listing), rowLevel),
    breakdowns: {
      platform: toLabelRows(rowsOf(platform), (r) => r.publisher_platform || 'unknown'),
      placement: toLabelRows(rowsOf(placement), (r) => `${r.publisher_platform || 'unknown'} · ${r.platform_position || 'unknown'}`),
      age: toLabelRows(ag, (r) => r.age || 'unknown'),
      gender: toLabelRows(ag, (r) => r.gender || 'unknown'),
      device: toLabelRows(rowsOf(device), (r) => r.device_platform || 'unknown'),
    },
    breakdownError,
  }

  putCache(cacheKey, payload)
  return NextResponse.json({ ...payload, cached: false })
}
