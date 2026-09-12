import { NextRequest, NextResponse } from 'next/server'
import { _sb as supabase } from '@/lib/supabaseClient'
import { getMidtransAuthHeader, MIDTRANS_CONFIG, generateOrderId, JOURNALYZE_PRICE } from '@/lib/midtrans'

export async function POST(req: NextRequest) {
  try {
    

    // Ambil user yang sedang login
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ambil profil user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email, plan')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Kalau sudah premium, jangan bisa beli lagi
    if (profile.plan === 'premium') {
      return NextResponse.json({ error: 'Already premium' }, { status: 400 })
    }

    // Generate order ID unik
    const orderId = generateOrderId(user.id)

    // Payload ke Midtrans
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: JOURNALYZE_PRICE,
      },
      customer_details: {
        first_name: profile.display_name || 'User',
        email: profile.email || user.email,
      },
      item_details: [
        {
          id: 'JOURNALYZE-PREMIUM',
          price: JOURNALYZE_PRICE,
          quantity: 1,
          name: 'Journalyze Premium - Akses Seumur Hidup',
        },
      ],
      callbacks: {
        finish: `https://journalyze.my.id/payment/success?order_id=${orderId}`,
        error: `https://journalyze.my.id/payment/failed`,
        pending: `https://journalyze.my.id/payment/pending`,
      },
      // Webhook URL di-set di sini langsung
      notification_url: 'https://journalyze.my.id/api/midtrans/webhook',
      // Custom field untuk tracking user ID
      custom_field1: user.id,
    }

    // Request ke Midtrans
    const response = await fetch(MIDTRANS_CONFIG.snapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getMidtransAuthHeader(),
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Midtrans error:', data)
      return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 })
    }

    // Simpan order ID ke profil user untuk tracking
    await supabase
      .from('profiles')
      .update({ midtrans_order_id: orderId })
      .eq('id', user.id)

    return NextResponse.json({
      token: data.token,
      redirect_url: data.redirect_url,
      order_id: orderId,
    })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}