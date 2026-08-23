// hooks/usePhotoAnalysis.ts
// 1:1 port dari fungsi analyzePhoto, handlePhotos, compressImage,
// readFileAsBase64, handleFotoAnalisa, renderFotoAnalisaGrid,
// rmFotoAnalisa, openFotoFull di index.html
'use client';

import { useState, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────
// HELPERS (1:1 index.html)
// ─────────────────────────────────────────────

export function compressImage(base64: string, maxPx = 1024, quality = 0.80): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else        { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // fallback tanpa compress
    img.src = base64;
  });
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target!.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
// OCR PROMPT (1:1 index.html line ~5293)
// ─────────────────────────────────────────────

const OCR_PROMPT = `Kamu adalah sistem OCR untuk jurnal trading. Analisis screenshot MT4/MT5 ini.

PRIORITAS: Jika ada multiple trade, ambil yang paling depan/highlighted/expanded.

Ekstrak data berikut:
- pair: nama pair (XAUUSDm → hapus 'm' → XAUUSD, NAS100→NASDAQ)
- posisi: Buy atau Sell
- lot: angka lot (contoh: 0.01, 0.1)
- entry: open price
- close: close price (jika sudah ditutup)
- sl: nilai S/L jika ada, null jika tidak ada
- tp: nilai T/P jika ada, null jika tidak ada
- result: Profit (warna biru/positif) atau Lose (warna merah/negatif)
- tanggal: format YYYY-MM-DD dari open time (bukan close time). Contoh: 2026.01.13 → 2026-01-13

ATURAN KHUSUS:
- Angka P/L dengan spasi: -51 369.69 = -51369.69
- Warna biru = Profit, merah = Lose
- Hapus suffix 'm' dari pair
- Ambil tanggal dari open time, bukan close time
- Jawab HANYA JSON, tanpa markdown, tanpa penjelasan:

{"pair":"XAUUSD","posisi":"Buy","lot":0.01,"entry":4586.382,"close":4583.339,"sl":4583.339,"tp":4601.952,"result":"Lose","tanggal":"2026-01-13"}`;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface OcrResult {
  pair?: string;
  posisi?: string;
  lot?: number | null;
  entry?: number | null;
  close?: number | null;
  sl?: number | null;
  tp?: number | null;
  result?: string;
  tanggal?: string;
}

type AiDotState = 'idle' | 'loading' | 'success' | 'error';

// ─────────────────────────────────────────────
// usePhotoAnalysis — OCR upload zone (top modal)
// 1:1 handlePhotos + analyzePhoto (index.html)
// ─────────────────────────────────────────────

export function usePhotoAnalysis() {
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [aiStatus,       setAiStatus]       = useState<string | null>(null);
  const [aiDotState,     setAiDotState]     = useState<AiDotState>('idle');
  const analyzing = useRef(false);

  // ── analyzePhoto — 1:1 index.html line 5276 ──────────────────────────────
  const analyzePhoto = useCallback(async (
    base64img: string,
    onResult: (r: OcrResult) => void,
    onApiKeyNeeded: () => void,
  ) => {
    if (analyzing.current) return;
    analyzing.current = true;

    setAiDotState('loading');
    setAiStatus('🗜️ Kompres gambar...');

    // Kompres dulu sebelum kirim → hemat 50-70% bandwidth & waktu
    const compressed = await compressImage(base64img, 1024, 0.80);
    const mediaType  = 'image/jpeg';
    const imgData    = compressed.split(',')[1];

    setAiStatus('🔍 Menganalisis foto trade...');

    // ── Cek provider & API key (1:1 index.html) ──
    const provider  = localStorage.getItem('jz_ai_provider') || 'gemini';
    const geminiKey = localStorage.getItem('jz_gemini_key')  || '';
    const claudeKey = localStorage.getItem('jz_anthropic_key') || '';

    if (provider === 'gemini' && !geminiKey) {
      setAiStatus('⚠️ Gemini API key belum diset. Klik tombol "API Key" di topbar.');
      setAiDotState('error');
      analyzing.current = false;
      onApiKeyNeeded();
      return;
    }
    if (provider === 'claude' && !claudeKey) {
      setAiStatus('⚠️ Claude API key belum diset. Klik tombol "API Key" di topbar.');
      setAiDotState('error');
      analyzing.current = false;
      onApiKeyNeeded();
      return;
    }

    try {
      let txt = '';

      // ── GEMINI VISION (1:1 index.html line ~5351) ──
      if (provider === 'gemini') {
        const model       = 'gemini-2.5-flash';
        const maxRetry    = 3;
        const retryDelays = [1500, 3000, 6000]; // exponential backoff
        let   lastErr     = '';

        const reqBody = JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mediaType, data: imgData } },
            { text: OCR_PROMPT },
          ]}],
          generationConfig: { maxOutputTokens: 1024, temperature: 0 },
        });

        for (let attempt = 1; attempt <= maxRetry; attempt++) {
          setAiStatus(`🔍 Menganalisa dengan ${model}${attempt > 1 ? ` (retry ${attempt}/${maxRetry})` : ''}...`);
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody },
            );
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as { error?: { message?: string } };
              const status  = resp.status;
              if (status === 429) { lastErr = 'Kuota harian habis — coba lagi besok jam 14.00 WIB'; break; }
              else if (status === 503) {
                lastErr = 'Server Gemini sedang sibuk';
                if (attempt < maxRetry) {
                  setAiStatus(`⏳ Server sibuk, tunggu ${retryDelays[attempt - 1] / 1000}s... (${attempt}/${maxRetry})`);
                  await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
                  continue;
                }
              }
              else if (status === 404) { lastErr = 'Model tidak tersedia'; break; }
              else { lastErr = errData?.error?.message || `Error ${status}`; break; }
            } else {
              const data = await resp.json() as { candidates?: { content: { parts: { text?: string }[] } }[] };
              txt = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
              if (txt) break;
              lastErr = 'Respons kosong dari Gemini';
            }
          } catch (e) { lastErr = (e as Error).message; break; }
        }

        if (!txt) throw new Error(lastErr || 'Analisa gagal');

      // ── CLAUDE VISION (1:1 index.html line ~5394) ──
      } else {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':    'application/json',
            'x-api-key':       claudeKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imgData } },
              { type: 'text',  text: OCR_PROMPT },
            ]}],
          }),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({})) as { error?: { message?: string } };
          if (resp.status === 401) throw new Error('API key tidak valid atau expired');
          if (resp.status === 429) throw new Error('Rate limit Claude — coba lagi dalam beberapa detik');
          throw new Error(errData?.error?.message || 'API error ' + resp.status);
        }
        const data = await resp.json() as { error?: { message?: string }; content?: { text?: string }[] };
        if (data.error) throw new Error(data.error.message || 'API error');
        txt = (data.content || []).map(c => c.text || '').join('').trim();
        if (!txt) throw new Error('Respons kosong dari API');
      }

      // ── Parse JSON — robust (1:1 index.html line ~5420) ──
      let cleanTxt = txt
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const jsonMatch = cleanTxt.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Format respons tidak valid — isi manual');

      let parsed: OcrResult;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = JSON.parse(jsonMatch[0].trim());
      }

      setAiStatus('✅ Data berhasil dibaca! Cek & lengkapi catatan/strategi/sesi.');
      setAiDotState('success');
      onResult(parsed);

    } catch (e) {
      let msg = (e as Error).message || 'Error tidak diketahui';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        msg = 'Koneksi gagal — pastikan terhubung internet';
      }
      setAiStatus('⚠️ ' + msg);
      setAiDotState('error');
    } finally {
      analyzing.current = false;
    }
  }, []);

  // ── handlePhotos — 1:1 index.html line 5259 ──────────────────────────────
  // Baca semua file paralel, push ke preview, analisa foto pertama saja
  const handleOcrFiles = useCallback(async (
    files: FileList | null,
    onResult: (r: OcrResult) => void,
    onApiKeyNeeded: () => void,
  ) => {
    if (!files || !files.length) return;

    const arr = Array.from(files).filter(f => {
      if (f.size > 10 * 1024 * 1024) return false; // maks 10MB (1:1)
      return true;
    });
    if (!arr.length) return;

    // Baca SEMUA file secara paralel (1:1 index.html)
    const results  = await Promise.all(arr.map(readFileAsBase64));
    const isFirst  = uploadPreviews.length === 0; // apakah ini batch pertama

    setUploadPreviews(prev => [...prev, ...results]);

    // Analisa otomatis hanya foto pertama yang di-upload (1:1 index.html)
    if (isFirst && results.length > 0) {
      await analyzePhoto(results[0], onResult, onApiKeyNeeded);
    }
  }, [uploadPreviews, analyzePhoto]);

  const removeOcrPreview = useCallback((i: number) => {
    setUploadPreviews(prev => prev.filter((_, j) => j !== i));
  }, []);

  const resetOcrStatus = useCallback(() => {
    setAiStatus(null);
    setAiDotState('idle');
  }, []);

  return {
    uploadPreviews,
    aiStatus,
    aiDotState,
    handleOcrFiles,
    removeOcrPreview,
    resetOcrStatus,
  };
}

// ─────────────────────────────────────────────
// useFotoAnalisa — section "Foto Analisa" collapsible
// 1:1 handleFotoAnalisa, renderFotoAnalisaGrid,
//     rmFotoAnalisa, openFotoFull (index.html)
// ─────────────────────────────────────────────

export function useFotoAnalisa(initial: string[] = []) {
  const [fotoAnalisa, setFotoAnalisa] = useState<string[]>(initial);
  const [fotoOpen,    setFotoOpen]    = useState(false);

  // toggleFotoAnalisa (1:1 index.html line 5489)
  const toggleFotoAnalisa = useCallback(() => setFotoOpen(p => !p), []);

  // handleFotoAnalisa (1:1 index.html line 5497)
  // Supabase Storage dulu, fallback base64
  const handleFotoAnalisaFiles = useCallback(async (
    files:  FileList | null,
    sb:     { storage: { from: (b: string) => { upload: (p: string, f: File, o: object) => Promise<{ data: { path: string } | null; error: Error | null }>; getPublicUrl: (p: string) => { data: { publicUrl: string } }; remove: (p: string[]) => Promise<unknown> } } } | null,
    userId: string | null,
  ) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);

    // Proses semua file secara paralel (1:1 index.html)
    await Promise.all(arr.map(async file => {
      // Coba Supabase Storage dulu
      if (sb && userId) {
        try {
          const ext  = file.name.split('.').pop() || 'jpg';
          const path = `${userId}/analisa_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { data, error } = await sb.storage
            .from('trade-photos')
            .upload(path, file, { upsert: false, contentType: file.type });
          if (!error && data) {
            const { data: urlData } = sb.storage.from('trade-photos').getPublicUrl(data.path);
            setFotoAnalisa(prev => [...prev, urlData.publicUrl]);
            return;
          }
          console.warn('Storage upload gagal, fallback base64:', error?.message);
        } catch (e) {
          console.warn('Storage error, fallback base64:', (e as Error).message);
        }
      }
      // Fallback: base64 + kompres (1:1 index.html)
      const raw        = await readFileAsBase64(file);
      const compressed = await compressImage(raw, 1024, 0.80);
      setFotoAnalisa(prev => [...prev, compressed]);
    }));
  }, []);

  // rmFotoAnalisa (1:1 index.html line 5550)
  const rmFotoAnalisa = useCallback((
    i:  number,
    sb: { storage: { from: (b: string) => { remove: (p: string[]) => Promise<unknown> } } } | null,
  ) => {
    setFotoAnalisa(prev => {
      const src = prev[i];
      // Kalau URL Supabase Storage, hapus dari storage juga (1:1)
      if (src && src.startsWith('http') && sb) {
        try {
          const match = src.match(/trade-photos\/(.+)$/);
          if (match) sb.storage.from('trade-photos').remove([decodeURIComponent(match[1])]);
        } catch (e) { console.warn('Storage delete error:', e); }
      }
      return prev.filter((_, j) => j !== i);
    });
  }, []);

  // openFotoFull (1:1 index.html line 5560)
  const openFotoFull = useCallback((src: string) => {
    const ov    = document.createElement('div');
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;' +
      'align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px);';

    const img = document.createElement('img');
    img.src   = src;
    img.style.cssText =
      'max-width:92vw;max-height:88vh;border-radius:10px;' +
      'border:1px solid rgba(212,175,55,0.3);box-shadow:0 20px 60px rgba(0,0,0,0.8);';

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText =
      'position:absolute;top:18px;right:22px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:7px;' +
      'width:32px;height:32px;font-size:14px;cursor:pointer;backdrop-filter:blur(4px);' +
      'display:flex;align-items:center;justify-content:center;';

    ov.appendChild(img);
    ov.appendChild(close);
    ov.addEventListener('click',    () => ov.remove());
    close.addEventListener('click', (e) => { e.stopPropagation(); ov.remove(); });
    document.body.appendChild(ov);
  }, []);

  return {
    fotoAnalisa,
    setFotoAnalisa,
    fotoOpen,
    toggleFotoAnalisa,
    handleFotoAnalisaFiles,
    rmFotoAnalisa,
    openFotoFull,
  };
}