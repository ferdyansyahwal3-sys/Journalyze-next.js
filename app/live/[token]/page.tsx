// app/live/[token]/page.tsx
// Halaman publik — siapa saja bisa buka, tidak perlu login
// Data di-revalidate tiap 60 detik (ISR)

import { notFound } from 'next/navigation'
import { getShareByToken } from '@/lib/shareToken'
import { _sb as supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
const LivePublicView = dynamic(() => import('@/components/live/LivePublicView'), { ssr: false })

export const revalidate = 60   // ISR: fresh tiap 1 menit

interface Props {
  params: { token: string }
}

export async function generateMetadata({ params }: Props) {
  const share = await getShareByToken(params.token)
  if (!share) return { title: 'Tidak Ditemukan — Journalyze' }
  return {
    title: 'Live Journal — Journalyze',
    description: 'Statistik trading live dari Journalyze.',
  }
}

export default async function LiveSharePage({ params }: Props) {
  // 1. Validasi token
  const share = await getShareByToken(params.token)
  if (!share) notFound()

  // 2. Ambil data trades milik user pemilik token
  
  const { data: trades, error } = await supabase
    .from('trades')                   // ← sesuaikan dengan nama tabel trades kamu
    .select('*')
    .eq('user_id', share.user_id)
    .order('tanggal', { ascending: false })
    .limit(500)

  if (error) {
    // Tetap render halaman, kirim array kosong
    console.error('[LiveSharePage] supabase error:', error.message)
  }

  return (
    <LivePublicView
      trades={trades ?? []}
      shareToken={params.token}
      config={{
        showTrades:  share.show_trades,
        showEquity:  share.show_equity,
        showWinrate: share.show_winrate,
        showPlan:    share.show_plan,
      }}
    />
  )
}