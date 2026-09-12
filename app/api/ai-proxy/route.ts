// app/api/ai-proxy/route.ts
// Server-side proxy untuk Gemini API — bypass CORS dan quota browser
// v3: model chain lengkap Sept 2026 + better error logging

import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Model chain lengkap Sept 2026 — dari ringan ke berat
// Semua nama valid per https://ai.google.dev/gemini-api/docs/models
const MODEL_CHAIN = [
  'gemini-2.0-flash',                        // stable, paling reliable
  'gemini-2.0-flash-lite',                   // lebih ringan dari 2.0-flash
  'gemini-2.5-flash',                        // latest flash
  'gemini-2.5-flash-lite',                   // lite version
  'gemini-2.5-flash-preview-05-20',          // preview fallback
  'gemini-2.5-flash-lite-preview-06-17',     // preview lite fallback
  'gemini-1.5-flash',                        // legacy stable
  'gemini-1.5-flash-8b',                     // smallest legacy
  'gemini-1.5-pro',                          // pro legacy
  'gemini-2.5-pro',                          // latest pro (paling lambat)
];

async function tryGemini(
  model: string,
  apiKey: string,
  body: object,
  version: 'v1beta' | 'v1' = 'v1beta'
): Promise<{ ok: boolean; status: number; json: unknown | null; errText?: string }> {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (r.ok) {
      return { ok: true, status: 200, json: await r.json() };
    }
    const errText = await r.text().catch(() => '');
    console.log(`[ai-proxy] ${model}/${version} → ${r.status}: ${errText.slice(0, 120)}`);
    return { ok: false, status: r.status, json: null, errText };
  } catch (e) {
    const msg = (e as Error).message;
    console.log(`[ai-proxy] ${model}/${version} exception: ${msg}`);
    return { ok: false, status: 0, json: null, errText: msg };
  }
}

function extractText(data: unknown): string {
  const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (d?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey: bodyApiKey, maxTokens = 1200 } = await request.json();

    // Key dari request body (per-user dari localStorage) — wajib ada
    const apiKey = bodyApiKey && String(bodyApiKey).trim();

    if (!apiKey) return NextResponse.json({
      ok: false,
      error: 'Gemini API key tidak ditemukan. Tambahkan key di menu Pengaturan AI.'
    }, { status: 400, headers: CORS });
    if (!prompt) return NextResponse.json({ ok: false, error: 'prompt required' }, { status: 400, headers: CORS });

    // Sanitasi key — hapus whitespace
    const cleanKey = String(apiKey).trim();

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
    };

    console.log(`[ai-proxy] Starting with ${MODEL_CHAIN.length} models, key prefix: ${cleanKey.slice(0,8)}...`);

    let last404Count = 0;

    for (const model of MODEL_CHAIN) {
      for (const ver of ['v1beta', 'v1'] as const) {
        const res = await tryGemini(model, cleanKey, geminiBody, ver);

        if (res.ok) {
          const text = extractText(res.json);
          console.log(`[ai-proxy] ✅ Success: ${model}/${ver}, text length: ${text.length}`);
          return NextResponse.json(
            { ok: true, text, model: `${model}/${ver}` },
            { headers: { ...CORS, 'Cache-Control': 'no-store' } }
          );
        }

        if (res.status === 429) {
          console.log('[ai-proxy] Rate limited, waiting 4s...');
          await new Promise(r => setTimeout(r, 4000));
          const retry = await tryGemini(model, cleanKey, geminiBody, ver);
          if (retry.ok) {
            const text = extractText(retry.json);
            return NextResponse.json({ ok: true, text, model: `${model}/${ver}-retry` }, { headers: CORS });
          }
          return NextResponse.json(
            { ok: false, error: 'Rate limit. Tunggu 1 menit lalu refresh.', status: 429 },
            { status: 429, headers: CORS }
          );
        }

        if (res.status === 403) {
          console.log('[ai-proxy] 403 Forbidden — invalid API key or billing issue');
          return NextResponse.json(
            {
              ok: false,
              error: 'API key ditolak (403). Pastikan:\n1. Key dari https://aistudio.google.com/apikey\n2. Billing di-enable di Google Cloud\n3. Gemini API di-enable di project',
              status: 403,
            },
            { status: 403, headers: CORS }
          );
        }

        if (res.status === 404) {
          last404Count++;
          continue; // coba model/version berikutnya
        }

        // Error lain (500, dsb) — coba model berikutnya
        console.log(`[ai-proxy] Unexpected status ${res.status} for ${model}, trying next...`);
      }
    }

    // Semua model 404
    console.log(`[ai-proxy] All ${last404Count} attempts returned 404`);
    return NextResponse.json(
      {
        ok: false,
        status: 404,
        error: `Semua ${MODEL_CHAIN.length} model Gemini tidak tersedia (404).\n\nKemungkinan penyebab:\n1. API key salah format — pastikan key dari https://aistudio.google.com/apikey (format: AIza... atau AQ...)\n2. Gemini API belum di-enable — buka https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n3. Project sudah expired atau billing bermasalah\n\nTest key kamu: buka https://aistudio.google.com dan coba generate sesuatu.`,
      },
      { status: 404, headers: CORS }
    );
  } catch (e) {
    console.error('[ai-proxy] Unhandled error:', e);
    return NextResponse.json({ ok: false, error: `Server error: ${String(e)}` }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}