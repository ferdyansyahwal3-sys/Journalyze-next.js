// lib/affiliateConfig.ts
// Sumber tunggal harga & komisi affiliate. Dipakai webhook (server) dan panel admin (tampilan).
// Komisi berupa nominal tetap per paket dan sama untuk semua partner.

export const COMMISSION_MAP: Record<string, number> = {
  basic:   20000,
  pro:     30000,
  elite:   50000,
  premium: 50000, // alias fallback
}

export const PRICE_MAP: Record<string, number> = {
  basic:   99000,
  pro:     149000,
  elite:   249000,
  premium: 249000,
}
