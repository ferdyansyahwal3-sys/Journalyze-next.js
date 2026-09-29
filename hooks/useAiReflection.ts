// hooks/useAiReflection.ts
'use client';

import { useCallback } from 'react';
import { _sb } from '@/lib/supabaseClient';
import { useJournalStore } from '@/store/useJournalStore';
import { usePlan } from '@/hooks/usePlan';
import type { Trade } from '@/lib/types';

export interface AiReflection {
  generated_at: string;
  visual: string;
  strategy_check: string;
  pattern: string;
  suggestions: string[];
  grade: 'A' | 'B' | 'C' | 'D';
  grade_reason: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('jz_gemini_key') || localStorage.getItem('jz_anthropic_key') || '';
}

function hasApiKey(): boolean {
  return !!getApiKey();
}

function calcStats(trade: Trade, allTrades: Trade[]) {
  const before = allTrades.filter(
    (t) => t.id !== trade.id && t.tanggal <= trade.tanggal
  );
  const total = before.length;
  const wins = before.filter((t) => t.result === 'Profit').length;
  const wrOverall = total > 0 ? Math.round((wins / total) * 100) : 0;

  const byPair = before.filter((t) => t.pair === trade.pair);
  const byPairWins = byPair.filter((t) => t.result === 'Profit').length;
  const wrPair =
    byPair.length > 0 ? Math.round((byPairWins / byPair.length) * 100) : 0;

  const bySesi = before.filter((t) => t.sesi === trade.sesi);
  const bySesiWins = bySesi.filter((t) => t.result === 'Profit').length;
  const wrSesi =
    bySesi.length > 0 ? Math.round((bySesiWins / bySesi.length) * 100) : 0;

  const metode = trade.metode || trade.strategi || '';
  const byMetode = before.filter(
    (t) => (t.metode || t.strategi || '') === metode
  );
  const byMetodeWins = byMetode.filter((t) => t.result === 'Profit').length;
  const wrMetode =
    byMetode.length > 0
      ? Math.round((byMetodeWins / byMetode.length) * 100)
      : 0;

  const last5 = [...before]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 5)
    .map((t) => ({
      pair: t.pair,
      result: t.result,
      pl: t._pl ?? null,
    }));

  return {
    total,
    wrOverall,
    wrPair: { pct: wrPair, n: byPair.length },
    wrSesi: { pct: wrSesi, n: bySesi.length },
    wrMetode: { pct: wrMetode, n: byMetode.length, metode },
    last5,
  };
}

function buildPrompt(trade: Trade, stats: ReturnType<typeof calcStats>): string {
  const hasFoto =
    Array.isArray(trade.fotoAnalisa) && trade.fotoAnalisa.length > 0;

  return `Kamu adalah AI coach trading forex/gold profesional. Analisa trade berikut dan berikan refleksi mendalam dalam bahasa Indonesia.

=== DATA TRADE ===
Pair: ${trade.pair}
Posisi: ${trade.posisi}
Sesi: ${trade.sesi}
Tanggal: ${trade.tanggal}
Entry: ${trade.entry ?? '-'}
SL: ${trade.sl ?? '-'}
TP: ${trade.tp ?? '-'}
Close: ${trade.close ?? '-'}
Lot: ${trade.lot ?? '-'}
Pips: ${trade.pips ?? '-'}
Risk/Reward: ${trade.rr != null ? '1:' + trade.rr : '-'}
Result: ${trade.result}
P&L: ${trade._pl != null ? trade._pl : '-'}
Metode/Strategi: ${trade.metode || trade.strategi || '-'}
Reason Entry: ${trade.reason || '-'}
Reasoning Fibonacci: ${trade.reasonFib || '-'}
Custom Reasoning: ${trade.reasonCustom || '-'}
Risk Level: ${trade.riskLevel || '-'}
Emosi & Kontrol: ${trade.emosiKontrol || '-'}
Catatan: ${trade.catatan || '-'}

=== STATISTIK HISTORIS USER ===
Total trade sebelum ini: ${stats.total}
Win rate overall: ${stats.wrOverall}% dari ${stats.total} trade
Win rate ${trade.pair}: ${stats.wrPair.pct}% dari ${stats.wrPair.n} trade
Win rate sesi ${trade.sesi}: ${stats.wrSesi.pct}% dari ${stats.wrSesi.n} trade
Win rate metode ${stats.wrMetode.metode}: ${stats.wrMetode.pct}% dari ${stats.wrMetode.n} trade
5 trade terakhir sebelum ini: ${JSON.stringify(stats.last5)}

=== FOTO ANALISA ===
${hasFoto ? `Foto analisa chart tersedia (${trade.fotoAnalisa.length} foto). Deskripsikan apa yang mungkin terlihat di chart berdasarkan konteks data trade di atas — setup, struktur harga, dan validitas entry.` : 'Tidak ada foto analisa untuk trade ini.'}

=== FORMAT RESPONSE ===
Balas HANYA dengan JSON valid ini, tanpa markdown, tanpa preamble:
{
  "visual": "Analisa visual chart berdasarkan konteks (atau '-' jika tidak ada foto)",
  "strategy_check": "Apakah eksekusi sesuai strategi yang dipilih? Validasi detail berdasarkan data.",
  "pattern": "Pola dari historis trading user yang relevan dengan trade ini. Sebutkan angka konkret dari statistik.",
  "suggestions": ["saran konkret 1", "saran konkret 2", "saran konkret 3"],
  "grade": "A atau B atau C atau D",
  "grade_reason": "Alasan singkat grade ini dalam 1-2 kalimat"
}

Rubrik grade:
A = Setup valid, eksekusi sesuai strategi, result sesuai ekspektasi
B = Setup valid tapi ada 1-2 hal yang bisa diperbaiki
C = Setup kurang kuat atau eksekusi tidak sesuai strategi
D = Setup lemah, banyak yang perlu dievaluasi`;
}

async function callAiProxy(prompt: string): Promise<AiReflection | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, apiKey, maxTokens: 1500 }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('[useAiReflection] AI error:', data.error);
      return null;
    }

    // Strip markdown fences jika ada
    let raw = (data.text as string).trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    const parsed = JSON.parse(raw) as Omit<AiReflection, 'generated_at'>;
    return {
      ...parsed,
      generated_at: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[useAiReflection] parse/fetch error:', e);
    return null;
  }
}

async function saveToSupabase(tradeId: string, reflection: AiReflection): Promise<void> {
  try {
    const { error } = await _sb
      .from('trades')
      .update({ ai_reflection: reflection })
      .eq('id', tradeId);
    if (error) console.warn('[useAiReflection] supabase save error:', error.message);
  } catch (e) {
    console.warn('[useAiReflection] supabase exception:', e);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAiReflection() {
  const { showToast } = useJournalStore();
  const { canAI } = usePlan();

  const triggerAiReflection = useCallback(
    async (trade: Trade, allTrades: Trade[]) => {
      // Cek plan dulu — jika bukan pro/elite, skip diam-diam
      if (!canAI) return;

      // Cek API key — tampilkan toast 1x per session jika belum ada
      if (!hasApiKey()) {
        const notifKey = 'jz_ai_notif_shown';
        if (!sessionStorage.getItem(notifKey)) {
          sessionStorage.setItem(notifKey, '1');
          showToast(
            '💡 Hubungkan API key Gemini untuk dapat AI refleksi otomatis di setiap trade kamu',
            'success'
          );
        }
        return;
      }

      // Jalankan AI di background — jangan await di caller
      (async () => {
        try {
          const stats = calcStats(trade, allTrades);
          const prompt = buildPrompt(trade, stats);
          const reflection = await callAiProxy(prompt);
          if (reflection) {
            await saveToSupabase(trade.id, reflection);
          }
        } catch (e) {
          console.warn('[useAiReflection] background error:', e);
        }
      })();
    },
    [canAI, showToast]
  );

  const fetchReflection = useCallback(
    async (tradeId: string): Promise<AiReflection | null> => {
      try {
        const { data, error } = await _sb
          .from('trades')
          .select('ai_reflection')
          .eq('id', tradeId)
          .single();
        if (error || !data?.ai_reflection) return null;
        return data.ai_reflection as AiReflection;
      } catch (e) {
        console.warn('[useAiReflection] fetchReflection error:', e);
        return null;
      }
    },
    []
  );

  const saveReflection = useCallback(
    async (tradeId: string, reflection: AiReflection): Promise<void> => {
      await saveToSupabase(tradeId, reflection);
    },
    []
  );

  const regenerateReflection = useCallback(
    async (trade: Trade, allTrades: Trade[]): Promise<AiReflection | null> => {
      if (!canAI || !hasApiKey()) return null;
      try {
        const stats = calcStats(trade, allTrades);
        const prompt = buildPrompt(trade, stats);
        const reflection = await callAiProxy(prompt);
        if (reflection) {
          await saveToSupabase(trade.id, reflection);
        }
        return reflection;
      } catch (e) {
        console.warn('[useAiReflection] regenerate error:', e);
        return null;
      }
    },
    [canAI]
  );

  return {
    triggerAiReflection,
    fetchReflection,
    saveReflection,
    regenerateReflection,
  };
}
