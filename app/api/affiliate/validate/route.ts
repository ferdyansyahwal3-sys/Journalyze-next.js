// app/api/affiliate/validate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { _sbAdmin } from '@/lib/supabaseClient'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.trim()

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const { data, error } = await _sbAdmin
    .from('affiliates')
    .select('name')
    .ilike('affiliate_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[AFFILIATE/VALIDATE] DB error:', error.message)
    return NextResponse.json({ valid: false }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, name: data.name })
}
