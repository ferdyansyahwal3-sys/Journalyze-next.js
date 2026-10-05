import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { sendCapiEvent, SITE_URL } from '@/lib/metaCapi'

export const dynamic = 'force-dynamic'
const NS = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Sesi admin tidak valid. Login ulang lalu coba lagi.' }, { status: 401, headers: NS })
  }
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  const pixelId  = String(body.pixelId  || '').trim()
  const token    = String(body.token    || '').trim()
  const testCode = String(body.testCode || '').trim()

  if (!/^\d+$/.test(pixelId))          return NextResponse.json({ error: 'Pixel ID tidak valid.' }, { status: 400, headers: NS })
  if (!/^\S{20,600}$/.test(token))     return NextResponse.json({ error: 'Conversion API Token belum diisi atau tidak valid.' }, { status: 400, headers: NS })
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(testCode)) return NextResponse.json({ error: 'Kode Testing belum diisi atau tidak valid.' }, { status: 400, headers: NS })

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const userData: Record<string, unknown> = { client_user_agent: req.headers.get('user-agent') || 'Journalyze-Admin-Test' }
  if (ip) userData.client_ip_address = ip

  const result = await sendCapiEvent(pixelId, token, {
    eventName: 'PageView',
    eventId: `test_${randomUUID()}`,
    sourceUrl: `${SITE_URL}/`,
    userData,
  }, testCode)

  if (!result.ok) return NextResponse.json({ error: `Meta menolak: ${result.error}` }, { status: 502, headers: NS })

  return NextResponse.json({ ok: true, events_received: result.eventsReceived ?? 0, fbtrace_id: result.fbtraceId ?? '-', test_event_code: testCode }, { headers: NS })
}
