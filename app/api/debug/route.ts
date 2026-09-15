import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    midtrans_key: process.env.MIDTRANS_SERVER_KEY ? 
      process.env.MIDTRANS_SERVER_KEY.substring(0, 15) + '...' : 'NOT SET',
    is_production: process.env.MIDTRANS_IS_PRODUCTION,
  })
}
