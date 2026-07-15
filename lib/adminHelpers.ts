// lib/adminHelpers.ts
// Fungsi-fungsi murni (pure function) dipindah verbatim dari admin.html.
// Tidak ada perubahan logic — hanya dibungkus jadi module.
import { DELIVERY_SECRET } from './supabaseClient';

// admin.html baris 667
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

// admin.html baris 582-586
export function encodeDeliveryToken(key: string, name: string): string {
  const ts = Date.now();
  const raw = `${key}|${name || ''}|${ts}|${DELIVERY_SECRET}`;
  return encodeURIComponent(btoa(raw));
}

// admin.html baris 588
export function genKeyString(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const s = (n: number) =>
    Array.from({ length: n }, () => c[Math.floor(Math.random() * c.length)]).join('');
  return `JZ-${s(4)}-${s(4)}`;
}
