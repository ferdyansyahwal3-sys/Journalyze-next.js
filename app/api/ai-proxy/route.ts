// app/api/ai-proxy/route.ts
// Server-side proxy untuk Gemini API — bypass CORS dan quota browser
import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MODEL_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

async function tryGemini(model: string, apiKey: string, body: object, version = 'v1beta') {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const errText = r.ok ? null : await r.text().catch(() => '');
    if (!r.ok) console.log(`[ai-proxy] ${model}/${version} → ${r.status}: ${(errText||'').slice(0,80)}`);
    return { ok: r.ok, status: r.status, json: r.ok ? await r.json() : null };
  } catch (e) {
    console.log(`[ai-proxy] ${model} exception:`, (e as Error).message);
    return { ok: false, status: 0, json: null };
  }
}

function extractText(data: unknown): string {
  const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (d?.candidates?.[0]?.content?.parts || []).map((p: {text?:string}) => p.text || '').join('');
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey, maxTokens = 1200 } = await request.json();
    if (!apiKey) return NextResponse.json({ ok: false, error: 'apiKey required' }, { status: 400, headers: CORS });
    if (!prompt) return NextResponse.json({ ok: false, error: 'prompt required' }, { status: 400, headers: CORS });

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
    };

    for (const model of MODEL_CHAIN) {
      for (const ver of ['v1beta', 'v1'] as const) {
        const res = await tryGemini(model, apiKey, geminiBody, ver);
        if (res.ok) {
          return NextResponse.json(
            { ok: true, text: extractText(res.json), model: `${model}/${ver}` },
            { headers: { ...CORS, 'Cache-Control': 'no-store' } }
          );
        }
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          const retry = await tryGemini(model, apiKey, geminiBody, ver);
          if (retry.ok) return NextResponse.json({ ok: true, text: extractText(retry.json), model: `${model}/${ver}-retry` }, { headers: CORS });
          return NextResponse.json({ ok: false, error: 'Rate limit. Coba lagi dalam 1 menit.', status: 429 }, { status: 429, headers: CORS });
        }
        if (res.status === 403) {
          return NextResponse.json({ ok: false, error: 'API key tidak valid (403 Forbidden)', status: 403 }, { status: 403, headers: CORS });
        }
        // 404 = model tidak ada, lanjut ke berikutnya
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Semua model Gemini 404. API key mungkin tidak punya akses Gemini API. Buat key baru di https://aistudio.google.com/apikey', status: 404 },
      { status: 404, headers: CORS }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
