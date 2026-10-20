// app/api/admin/proxy/route.ts — SERVER ONLY
// Meneruskan request admin (dari _sbAdmin di browser) ke Supabase memakai kunci rahasia server.
// Hanya admin yang sedang login (Bearer token sesi) yang boleh lewat.
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { SUPABASE_URL } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PREFIXES = ['/rest/v1/', '/auth/v1/admin/'];
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'];
const FORWARD_HEADERS = ['content-type', 'prefer', 'accept', 'accept-profile', 'content-profile', 'range', 'range-unit'];
const RETURN_HEADERS = ['content-type', 'content-range', 'content-profile'];

type ProxyPayload = {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server belum dikonfigurasi' }, { status: 500 });
  }

  let payload: ProxyPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const method = String(payload.method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: 'Method tidak diizinkan' }, { status: 405 });
  }

  let target: URL;
  try {
    target = new URL(String(payload.path || ''), SUPABASE_URL);
  } catch {
    return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 });
  }
  if (target.origin !== new URL(SUPABASE_URL).origin) {
    return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 });
  }
  if (!ALLOWED_PREFIXES.some((p) => target.pathname.startsWith(p))) {
    return NextResponse.json({ error: 'Path tidak diizinkan' }, { status: 403 });
  }

  const up = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = payload.headers?.[h];
    if (v) up.set(h, v);
  }
  up.set('apikey', serviceKey);
  // Kunci legacy (JWT) butuh Bearer; secret key baru (sb_secret_) cukup di header apikey.
  if (serviceKey.startsWith('eyJ')) up.set('authorization', `Bearer ${serviceKey}`);

  const hasBody = method !== 'GET' && method !== 'HEAD' && typeof payload.body === 'string';

  try {
    const upstream = await fetch(target.toString(), {
      method,
      headers: up,
      body: hasBody ? payload.body : undefined,
      cache: 'no-store',
    });

    const out = new Headers();
    for (const h of RETURN_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }

    const noBody = method === 'HEAD' || [204, 205, 304].includes(upstream.status);
    const buf = noBody ? null : await upstream.arrayBuffer();
    return new NextResponse(buf, { status: upstream.status, headers: out });
  } catch (err) {
    console.error('[admin/proxy] upstream error:', err);
    return NextResponse.json({ error: 'Gagal menghubungi database' }, { status: 502 });
  }
}
