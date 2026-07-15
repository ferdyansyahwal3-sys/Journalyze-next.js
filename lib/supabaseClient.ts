// lib/supabaseClient.ts
// Dipindah 1:1 dari admin.html baris 375-381.
// _sb  = client biasa (dipakai untuk auth & operasi normal, tunduk RLS)
// _sbAdmin = client dengan service_role key (bypass RLS, HANYA dipakai
//            setelah admin login terverifikasi) — perilaku dipertahankan
//            persis seperti versi lama sesuai keputusan Ferdy.
//
// CATATAN FIX: ditambahkan fallback default (nilai sama persis dengan yang
// dulu hardcoded di admin.html) supaya tidak error kalau .env.local belum
// dibuat / server dev belum di-restart setelah bikin .env.local. Kalau
// NEXT_PUBLIC_* di-set di .env.local, nilai itu yang dipakai (override).
import { createClient } from '@supabase/supabase-js';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icouldevrvvtkxiincle.supabase.co';
const SKEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_DWd-tWaAlTRQI12Q3VD5PQ_CYkc48fb';
const SKEY_ADMIN =
  process.env.NEXT_PUBLIC_SUPABASE_ADMIN_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljb3VsZGV2cnZ2dGt4aWluY2xlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1NjM4NCwiZXhwIjoyMDkzNDMyMzg0fQ.sxnE9bYGD57ZqZdPQ53qpDWUvDSu0wpW3oz2HTZgIzs';

export const _sb = createClient(SURL, SKEY);

export const _sbAdmin = createClient(SURL, SKEY_ADMIN, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DELIVERY_BASE =
  process.env.NEXT_PUBLIC_DELIVERY_BASE || 'https://journalyze.my.id';

export const ALLOWED_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAIL || 'ferdyansyahwal3@gmail.com';

export const DELIVERY_SECRET = process.env.NEXT_PUBLIC_DELIVERY_SECRET || 'JZ2025';
