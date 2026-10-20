// lib/supabaseClient.ts
// _sb      = client biasa (anon/publishable key, tunduk RLS) — aman di browser.
// _sbAdmin = client service-role.
//   - Di SERVER: pakai SUPABASE_SERVICE_ROLE_KEY langsung.
//   - Di BROWSER: TIDAK memegang kunci apa pun. Semua request diteruskan ke
//     /api/admin/proxy, yang memverifikasi login admin lalu memakai kunci di server.
// JANGAN pernah memakai prefix NEXT_PUBLIC_ untuk kunci service-role.
import { createClient } from '@supabase/supabase-js';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icouldevrvvtkxiincle.supabase.co';
const SKEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_DWd-tWaAlTRQI12Q3VD5PQ_CYkc48fb';

export const SUPABASE_URL = SURL;

export const _sb = createClient(SURL, SKEY);

async function adminProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(SURL + '/')) return fetch(input, init);

  const { data } = await _sb.auth.getSession();
  const token = data.session?.access_token ?? '';

  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((v, k) => {
    headers[k] = v;
  });

  return fetch('/api/admin/proxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      path: url.slice(SURL.length),
      method: (init?.method || 'GET').toUpperCase(),
      headers,
      body: typeof init?.body === 'string' ? init.body : undefined,
    }),
  });
}

function makeAdminClient() {
  const authOpts = { persistSession: false, autoRefreshToken: false };
  if (typeof window === 'undefined') {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) console.error('[supabaseClient] SUPABASE_SERVICE_ROLE_KEY belum di-set di server!');
    return createClient(SURL, key || SKEY, { auth: authOpts });
  }
  return createClient(SURL, SKEY, { auth: authOpts, global: { fetch: adminProxyFetch } });
}

export const _sbAdmin = makeAdminClient();

export const DELIVERY_BASE =
  process.env.NEXT_PUBLIC_DELIVERY_BASE || 'https://journalyze.my.id';

export const ALLOWED_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAIL || 'ferdyansyahwal3@gmail.com';

export const DELIVERY_SECRET = process.env.NEXT_PUBLIC_DELIVERY_SECRET || 'JZ2025';
