import crypto from 'crypto'

export const MIDTRANS_CONFIG = {
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  snapUrl: process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
}

export function getMidtransAuthHeader(): string {
  const encoded = Buffer.from(`${MIDTRANS_CONFIG.serverKey}:`).toString('base64')
  return `Basic ${encoded}`
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const rawString = orderId + statusCode + grossAmount + MIDTRANS_CONFIG.serverKey
  const hash = crypto.createHash('sha512').update(rawString).digest('hex')
  return hash === signatureKey
}

export function generateOrderId(userId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `JZ-${userId.substring(0, 8)}-${timestamp}-${random}`
}

export const JOURNALYZE_PRICE = 147000 // Rp147.000