// app/api/affiliate/event/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

const VALID_EVENT_TYPES = [
  'landing_view',
  'cta_click',
  'order_view',
  'plan_select',
  'checkout_start',
  'view',
  'click',
] as const

const VALID_PAGES = ['landing', 'order'] as const

type EventType = typeof VALID_EVENT_TYPES[number]
type PageType  = typeof VALID_PAGES[number]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      affiliate_code: string
      event_type: EventType
      page: PageType
      referrer?: string
      session_id?: string
      plan_type?: string
    }

    const { affiliate_code, event_type, page, referrer, session_id, plan_type } = body

    if (!affiliate_code || !event_type || !page) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({ ok: false, error: 'Invalid event_type' }, { status: 400 })
    }

    if (!VALID_PAGES.includes(page)) {
      return NextResponse.json({ ok: false, error: 'Invalid page' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') ?? null

    await _sbAdmin.from('affiliate_link_events').insert({
      affiliate_code: affiliate_code.toLowerCase().trim(),
      event_type,
      page,
      referrer:   referrer?.slice(0, 500) || null,
      user_agent: ua?.slice(0, 300) || null,
      session_id: session_id?.slice(0, 64) || null,
      plan_type:  plan_type?.toLowerCase() || null,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[AFFILIATE/EVENT]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
