// app/api/news-cache/route.ts
// Penulisan cache analisis AI bersama (tabel news_analysis_shared) lewat SERVER.
// Browser tidak lagi menulis langsung ke tabel (lihat 02_lock_news_cache.sql).
//
// POST { action: 'lock', items: [{ title }] }
// POST { action: 'save', items: [{ title, analysis, speculation, headline, scenario_bear, scenario_bull, desc, source, impact, category }] }
// Header: Authorization: Bearer <access_token Supabase milik user yang login>
//
// Perlindungan: wajib login, hash dihitung ulang di server, panjang dibatasi,
// HTML/URL ditolak, dan entri valid yang masih berlaku TIDAK bisa ditimpa
// (siapa yang menulis valid duluan, dialah yang dipakai sampai kedaluwarsa).

import { NextRequest, NextResponse } from 'next/server';
import { _sbAdmin } from '@/lib/supabaseClient';
import { hashTitle, isValidAnalysis, NEWS_CACHE_TTL_MS } from '@/lib/newsHash';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TABLE = 'news_analysis_shared';
const GENERATING_TIMEOUT_MS = 30 * 1000;
const MAX_ITEMS = 12;
const IMPACTS = new Set(['high', 'medium', 'low']);
const CATEGORIES = new Set(['forex', 'gold', 'crypto', 'economic', 'fed']);
const URL_RE = /(https?:\/\/|www\.)/i;

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max);
}

interface ExistingRow {
  title_hash: string;
  analysis: string | null;
  is_generating: boolean;
  expires_at: string;
}

async function loadExisting(hashes: string[]): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  if (!hashes.length) return map;
  const { data } = await _sbAdmin
    .from(TABLE)
    .select('title_hash,analysis,is_generating,expires_at')
    .in('title_hash', hashes);
  for (const r of (data || []) as ExistingRow[]) map.set(r.title_hash, r);
  return map;
}

function isLive(r: ExistingRow | undefined, nowIso: string): boolean {
  if (!r) return false;
  if (r.expires_at <= nowIso) return false;
  return r.is_generating || isValidAnalysis(r.analysis ?? undefined);
}

export async function POST(request: NextRequest) {
  // ── Auth: wajib user yang login ────────────────────────────────────────────
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { data: u, error: uErr } = await _sbAdmin.auth.getUser(token);
  if (uErr || !u?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body tidak valid' }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]).slice(0, MAX_ITEMS) : [];
  if (!items.length) return NextResponse.json({ ok: true, written: 0, skipped: 0 });

  const nowIso = new Date().toISOString();

  try {
    // ── lock: tandai "sedang di-generate" ────────────────────────────────────
    if (body.action === 'lock') {
      const titles = items.map(i => clean(i.title, 200)).filter(Boolean);
      const hashes = titles.map(hashTitle);
      const existing = await loadExisting(hashes);
      const rows = titles
        .map((title, i) => ({ title, hash: hashes[i] }))
        .filter(x => !isLive(existing.get(x.hash), nowIso))
        .map(x => ({
          title_hash: x.hash, title: x.title,
          analysis: '', speculation: '', headline: '',
          scenario_bear: '', scenario_bull: '', description: '',
          is_generating: true,
          expires_at: new Date(Date.now() + GENERATING_TIMEOUT_MS).toISOString(),
        }));
      if (rows.length) await _sbAdmin.from(TABLE).upsert(rows, { onConflict: 'title_hash' });
      return NextResponse.json({ ok: true, written: rows.length, skipped: titles.length - rows.length });
    }

    // ── save: simpan hasil analisis ──────────────────────────────────────────
    if (body.action === 'save') {
      const candidates = items
        .map(i => {
          const title = clean(i.title, 200);
          return {
            title,
            title_hash: title ? hashTitle(title) : '',
            analysis: clean(i.analysis, 2000),
            speculation: clean(i.speculation, 500),
            headline: clean(i.headline, 300),
            scenario_bear: clean(i.scenario_bear, 600),
            scenario_bull: clean(i.scenario_bull, 600),
            description: clean(i.desc, 400),
            source: clean(i.source, 60),
            impact: IMPACTS.has(String(i.impact)) ? String(i.impact) : 'medium',
            category: CATEGORIES.has(String(i.category)) ? String(i.category) : 'forex',
          };
        })
        .filter(c =>
          c.title_hash &&
          isValidAnalysis(c.analysis) &&
          !URL_RE.test([c.analysis, c.speculation, c.headline, c.scenario_bear, c.scenario_bull, c.description].join(' ')),
        );

      const existing = await loadExisting(candidates.map(c => c.title_hash));
      const toWrite = candidates.filter(c => {
        const ex = existing.get(c.title_hash);
        // Tolak menimpa entri valid yang masih berlaku; placeholder "generating" boleh diisi.
        return !(ex && !ex.is_generating && ex.expires_at > nowIso && isValidAnalysis(ex.analysis ?? undefined));
      });

      if (toWrite.length) {
        const expiresAt = new Date(Date.now() + NEWS_CACHE_TTL_MS).toISOString();
        await _sbAdmin.from(TABLE).upsert(
          toWrite.map(c => ({ ...c, is_generating: false, expires_at: expiresAt })),
          { onConflict: 'title_hash' },
        );
      }

      // Bersihkan entri lama (best effort)
      const cutoff = new Date(Date.now() - NEWS_CACHE_TTL_MS).toISOString();
      await _sbAdmin.from(TABLE).delete().lt('expires_at', cutoff).eq('is_generating', false);

      return NextResponse.json({ ok: true, written: toWrite.length, skipped: items.length - toWrite.length });
    }

    return NextResponse.json({ ok: false, error: 'action tidak dikenal' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[news-cache] Error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
