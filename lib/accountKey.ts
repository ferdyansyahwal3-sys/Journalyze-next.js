// lib/accountKey.ts
// SERVER ONLY — jangan di-import dari komponen 'use client'.
//
// Satu akun = satu kode akun (format JZ-XXXX-XXXX), disimpan di tabel license_keys.
// Idempotent: kalau user sudah punya kode, kode lama yang dikembalikan (tidak bikin ganda).
// Non-fatal: kalau gagal, return null — pembuatan akun / pembayaran tidak boleh ikut gagal.
import { randomInt } from 'crypto';
import { _sbAdmin } from '@/lib/supabaseClient';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function block(n: number): string {
  return Array.from({ length: n }, () => CHARS[randomInt(CHARS.length)]).join('');
}

export function makeAccountKey(): string {
  return `JZ-${block(4)}-${block(4)}`;
}

export async function ensureAccountKey(
  userId: string,
  customerName?: string | null
): Promise<string | null> {
  try {
    // 1. Sudah punya kode? Pakai yang tertua.
    const { data: existing, error: selErr } = await _sbAdmin
      .from('license_keys')
      .select('key')
      .eq('used_by', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (selErr) {
      console.error('[accountKey] select error:', selErr.message);
      return null;
    }
    if (existing?.key) return existing.key;

    // 2. Buat baru. Retry kalau bentrok dengan kode lain (unique violation 23505).
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      const key = makeAccountKey();
      const { error } = await _sbAdmin.from('license_keys').insert({
        key,
        is_used: true,
        is_revoked: false,
        customer_name: customerName?.trim() || null,
        used_by: userId,
        used_at: now,
        created_at: now,
      });
      if (!error) return key;
      if (error.code !== '23505') {
        console.error('[accountKey] insert error:', error.message);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error('[accountKey] unexpected:', err);
    return null;
  }
}
