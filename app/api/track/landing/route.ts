// app/api/track/landing/route.ts
// Tracking landing page utama untuk SEMUA pengunjung (organik, UTM, maupun affiliate).
// Terpisah dari /api/affiliate/event supaya funnel affiliate tidak tercampur.
import { NextRequest, NextResponse } from 'next/server';
import { _sbAdmin } from '@/lib/supabaseClient';

const VALID_EVENTS = ['landing_view', 'cta_click'] as const;
type LandingEventType = typeof VALID_EVENTS[number];

// Bot / crawler / link-preview tidak dihitung sebagai pengunjung
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime/i;

function clean(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      event_type?: string;
      session_id?: string;
      affiliate_code?: string | null;
      utm_source?: string | null;
      utm_medium?: string | null;
      utm_campaign?: string | null;
      referrer?: string | null;
      plan_type?: string | null;
    };

    if (!body.event_type || !VALID_EVENTS.includes(body.event_type as LandingEventType)) {
      return NextResponse.json({ ok: false, error: 'Invalid event_type' }, { status: 400 });
    }

    const ua = req.headers.get('user-agent') ?? '';
    if (!ua || BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, skipped: 'bot' });
    }

    const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';

    const { error } = await _sbAdmin.from('landing_events').insert({
      event_type:     body.event_type,
      session_id:     clean(body.session_id, 64),
      affiliate_code: clean(body.affiliate_code, 40)?.toLowerCase() ?? null,
      utm_source:     clean(body.utm_source, 80)?.toLowerCase() ?? null,
      utm_medium:     clean(body.utm_medium, 80)?.toLowerCase() ?? null,
      utm_campaign:   clean(body.utm_campaign, 120),
      referrer:       clean(body.referrer, 500),
      plan_type:      clean(body.plan_type, 20)?.toLowerCase() ?? null,
      device,
    });

    if (error) {
      console.error('[TRACK/LANDING] insert error:', error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[TRACK/LANDING]', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
