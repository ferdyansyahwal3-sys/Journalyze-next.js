// lib/adminAuth.ts — SERVER ONLY
import { _sb, ALLOWED_ADMIN_EMAIL } from '@/lib/supabaseClient'

/** Memastikan request datang dari admin yang sedang login (Bearer token sesi Supabase). */
export async function verifyAdminRequest(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('authorization') || ''
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    if (!token) return false

    const { data, error } = await _sb.auth.getUser(token)
    if (error || !data.user?.email) return false

    return data.user.email.toLowerCase() === ALLOWED_ADMIN_EMAIL.toLowerCase()
  } catch {
    return false
  }
}
