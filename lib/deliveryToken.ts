// lib/deliveryToken.ts
// Dipindah dari delivery.html baris 307-329 (decodeDeliveryToken).
// Pasangan dari encodeDeliveryToken() yang sudah ada di lib/adminHelpers.ts
// (dipakai admin.html buat generate URL delivery). Logic sama persis,
// termasuk TOKEN_EXPIRE_HOURS = 72 jam.
import { DELIVERY_SECRET } from './supabaseClient';

export const TOKEN_EXPIRE_HOURS = 72;

export interface DecodedToken {
  expired: boolean;
  key: string;
  name: string;
}

export function decodeDeliveryToken(token: string): DecodedToken | null {
  try {
    const decoded = atob(decodeURIComponent(token));
    const parts = decoded.split('|');
    if (parts.length < 3) return null;
    const [key, name, ts, salt] = parts;
    if (salt !== DELIVERY_SECRET) return null;

    const generatedAt = parseInt(ts, 10);
    const nowMs = Date.now();
    const expireMs = TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;
    if (nowMs - generatedAt > expireMs) {
      return { expired: true, key, name };
    }
    return { expired: false, key, name };
  } catch {
    return null;
  }
}
