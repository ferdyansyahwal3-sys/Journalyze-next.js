/**
 * lib/publicData.ts
 * Phase 10 — Public data fetching untuk /live route
 *
 * Semua query pakai _sb (anon key), bukan _sbAdmin.
 * RLS Supabase harus mengizinkan SELECT tanpa auth
 * untuk row yang live_public = true.
 *
 * Tidak ada auth check di sini — ini intentional.
 * /live adalah public read-only view.
 */

import { _sb } from './supabaseClient';
import type { Trade, WeeklyReview, MonthlyReview } from './types';

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface LiveProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  live_public: boolean;
}

export async function fetchLiveProfile(userId: string): Promise<{
  data: LiveProfile | null;
  error: string | null;
}> {
  const { data, error } = await _sb
    .from('profiles')
    .select('id, display_name, avatar_url, live_public')
    .eq('id', userId)
    .eq('live_public', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { data: null, error: 'User tidak mengaktifkan Live Mode.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as LiveProfile, error: null };
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export async function fetchPublicTrades(userId: string): Promise<{
  data: Trade[];
  error: string | null;
}> {
  const { data, error } = await _sb
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('open_time', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as Trade[]) ?? [], error: null };
}

// ─── Weekly Reviews ───────────────────────────────────────────────────────────

export async function fetchPublicWeeklyReviews(userId: string): Promise<{
  data: WeeklyReview[];
  error: string | null;
}> {
  const { data, error } = await _sb
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as WeeklyReview[]) ?? [], error: null };
}

// ─── Monthly Reviews ──────────────────────────────────────────────────────────

export async function fetchPublicMonthlyReviews(userId: string): Promise<{
  data: MonthlyReview[];
  error: string | null;
}> {
  const { data, error } = await _sb
    .from('monthly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as MonthlyReview[]) ?? [], error: null };
}

// ─── All-in-one fetch ─────────────────────────────────────────────────────────

export interface LivePageData {
  profile: LiveProfile | null;
  trades: Trade[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  profileError: string | null;
}

export async function fetchAllLiveData(userId: string): Promise<LivePageData> {
  // Fetch profile dulu — kalau gagal tidak perlu fetch sisanya
  const profileRes = await fetchLiveProfile(userId);

  if (!profileRes.data) {
    return {
      profile: null,
      trades: [],
      weeklyReviews: [],
      monthlyReviews: [],
      profileError: profileRes.error,
    };
  }

  // Parallel fetch sisanya
  const [tradesRes, weeklyRes, monthlyRes] = await Promise.all([
    fetchPublicTrades(userId),
    fetchPublicWeeklyReviews(userId),
    fetchPublicMonthlyReviews(userId),
  ]);

  return {
    profile: profileRes.data,
    trades: tradesRes.data,
    weeklyReviews: weeklyRes.data,
    monthlyReviews: monthlyRes.data,
    profileError: null,
  };
}