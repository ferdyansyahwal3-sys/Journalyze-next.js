// app/api/pixel/capi-status/route.ts
// Admin-only. Hanya mengembalikan ya/tidak apakah token CAPI terpasang — nilai token TIDAK pernah dikirim.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getCapiToken } from '@/lib/metaCapi'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  const ids = (req.nextUrl.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 20)

  const configured: Record<string, boolean> = {}
  for (const id of ids) configured[id] = getCapiToken(id) !== null

  return NextResponse.json({ configured })
}
