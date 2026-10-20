// @ts-nocheck — file ini berjalan di Deno (Supabase Edge Function), bukan Next.js.
// supabase/functions/expire-plans/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Proteksi tambahan: jika CRON_SECRET diset, header x-cron-secret wajib cocok
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Cari semua user basic yang plan_expires_at sudah lewat
  const { data: expired, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('plan', ['basic', 'trial'])
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', new Date().toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ message: 'No expired plans', count: 0 }))
  }

  // Downgrade semua ke free
  const ids = expired.map((u: { id: string }) => u.id)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      plan: 'free',
      plan_type: 'free',
      plan_expires_at: null,
    })
    .in('id', ids)
    .in('plan', ['basic', 'trial']) // guard: jangan timpa user yang baru saja upgrade

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
  }

  console.log(`[expire-plans] Downgraded ${expired.length} users to free`)
  return new Response(JSON.stringify({ message: 'Done', count: expired.length }))
})
