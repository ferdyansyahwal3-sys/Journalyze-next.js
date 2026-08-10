'use client';
/**
 * hooks/useLiveData.ts
 * Phase 10
 * Field Trade: result ('Profit'/'Lose'), posisi ('Buy'/'Sell'), tanggal, pair, _pl
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAllLiveData, type LivePageData, type LiveProfile } from '../lib/publicData';
import type { Trade, WeeklyReview, MonthlyReview } from '../lib/types';

export interface UseLiveDataReturn {
  loading: boolean;
  profileError: string | null;
  profile: LiveProfile | null;
  trades: Trade[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  filteredTrades: Trade[];
  filterPair: string;
  filterDir: string;
  filterResult: string;
  filterDateFrom: string;
  filterDateTo: string;
  setFilterPair: (v: string) => void;
  setFilterDir: (v: string) => void;
  setFilterResult: (v: string) => void;
  setFilterDateFrom: (v: string) => void;
  setFilterDateTo: (v: string) => void;
  resetFilters: () => void;
  uniquePairs: string[];
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  refetch: () => void;
}

export function useLiveData(userId: string | null): UseLiveDataReturn {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<LivePageData>({
    profile: null,
    trades: [],
    weeklyReviews: [],
    monthlyReviews: [],
    profileError: null,
  });

  const [filterPair,     setFilterPair]     = useState('');
  const [filterDir,      setFilterDir]      = useState('');
  const [filterResult,   setFilterResult]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [theme, setThemeState]              = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jz-theme') as 'dark' | 'light' | null;
      if (saved) setThemeState(saved);
    } catch (_) {}
  }, []);

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('jz-theme', t); } catch (_) {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await fetchAllLiveData(userId);
    setPageData(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter — pakai field Trade yang benar
  const filteredTrades = pageData.trades.filter(t => {
    // Pair
    if (filterPair && t.pair !== filterPair) return false;
    // Posisi (bukan direction) — 'Buy' atau 'Sell', case-insensitive
    if (filterDir && t.posisi?.toLowerCase() !== filterDir.toLowerCase()) return false;
    // Result — 'Profit' atau 'Lose'
    if (filterResult && t.result !== filterResult) return false;
    // Tanggal — field string 'YYYY-MM-DD'
    if (filterDateFrom && t.tanggal < filterDateFrom) return false;
    if (filterDateTo   && t.tanggal > filterDateTo)   return false;
    return true;
  });

  const uniquePairs = Array.from(
    new Set(pageData.trades.map(t => t.pair).filter(Boolean))
  ) as string[];

  const resetFilters = () => {
    setFilterPair('');
    setFilterDir('');
    setFilterResult('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return {
    loading,
    profileError: pageData.profileError,
    profile: pageData.profile,
    trades: pageData.trades,
    weeklyReviews: pageData.weeklyReviews,
    monthlyReviews: pageData.monthlyReviews,
    filteredTrades,
    filterPair,
    filterDir,
    filterResult,
    filterDateFrom,
    filterDateTo,
    setFilterPair,
    setFilterDir,
    setFilterResult,
    setFilterDateFrom,
    setFilterDateTo,
    resetFilters,
    uniquePairs,
    theme,
    setTheme,
    refetch: loadData,
  };
}