// components/journal/TradeBreakdown.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useJournalStore } from '@/store/useJournalStore';
import { useTradeStore } from '@/store/useTradeStore';
import { useAiReflection, type AiReflection } from '@/hooks/useAiReflection';
import { usePlan } from '@/hooks/usePlan';
import { _sb } from '@/lib/supabaseClient';
import '../../app/(journal)/breakdown.css';

function fmtDate(d: string) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function fmtMoney(val: number | null | undefined, currency: string): string {
  if (val == null) return '—';
  const abs = Math.abs(val).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const sym = currency === 'IDR' ? 'Rp' : '$';
  const sign = val >= 0 ? '+' : '-';
  return sign + sym + abs;
}

function getCurrency(): string {
  try { const s = JSON.parse(localStorage.getItem('jz_state') || 'null'); return s?.currency || 'IDR'; }
  catch { return 'IDR'; }
}

function hasApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(localStorage.getItem('jz_gemini_key') || localStorage.getItem('jz_anthropic_key'));
}

// ── Price Map ─────────────────────────────────────────────────────────────────
function PriceMap({ trade }: { trade: { entry: number | null; sl: number | null; tp: number | null; close: number | null; posisi: string; result: string } }) {
  const { entry, sl, tp, close, result } = trade;
  if (!entry) return <div className="bd-empty-field">Data harga tidak tersedia</div>;
  const isProfit = result === 'Profit';
  const prices = [entry, sl, tp, close].filter((p): p is number => p != null && p !== 0);
  if (prices.length < 2) return <div className="bd-empty-field">Data harga tidak lengkap</div>;
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const pct = (p: number) => ((p - minP) / range) * 80 + 10;
  const levels = [
    tp != null && tp !== 0 ? { price: tp, label: 'TP', color: 'var(--green)', pct: pct(tp) } : null,
    close != null ? { price: close, label: 'CLOSE', color: isProfit ? 'var(--blue)' : 'var(--red)', pct: pct(close) } : null,
    entry != null ? { price: entry, label: 'ENTRY', color: 'var(--gold)', pct: pct(entry) } : null,
    sl != null && sl !== 0 ? { price: sl, label: 'SL', color: 'var(--red)', pct: pct(sl) } : null,
  ].filter(Boolean) as { price: number; label: string; color: string; pct: number }[];
  levels.sort((a, b) => b.price - a.price);
  const pipDiff = (a: number | null, b: number | null) => a == null || b == null ? null : Math.abs(a - b).toFixed(2);
  return (
    <div className="bd-price-map">
      <div className="bd-price-line-wrap">
        <div className="bd-price-vline" />
        {levels.map(lv => (
          <div key={lv.label} className="bd-price-level" style={{ bottom: lv.pct + '%' }}>
            <div className="bd-price-dot" style={{ background: lv.color }} />
            <div className="bd-price-label" style={{ color: lv.color }}>{lv.label}</div>
            <div className="bd-price-val">{lv.price}</div>
          </div>
        ))}
      </div>
      <div className="bd-price-stats">
        {entry && sl && <div className="bd-price-stat"><span className="bd-price-stat-lbl">Entry → SL</span><span style={{ color: 'var(--red)' }}>{pipDiff(entry, sl)} pts</span></div>}
        {entry && tp && <div className="bd-price-stat"><span className="bd-price-stat-lbl">Entry → TP</span><span style={{ color: 'var(--green)' }}>{pipDiff(entry, tp)} pts</span></div>}
        {entry && close && <div className="bd-price-stat"><span className="bd-price-stat-lbl">Entry → Close</span><span style={{ color: isProfit ? 'var(--blue)' : 'var(--red)' }}>{pipDiff(entry, close)} pts</span></div>}
        {entry && sl && tp && <div className="bd-price-stat"><span className="bd-price-stat-lbl">R:R</span><span style={{ color: 'var(--gold2)' }}>{(Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2)}</span></div>}
      </div>
    </div>
  );
}

// ── AI Section ────────────────────────────────────────────────────────────────
function AiSection({ tradeId, onOpenApiKey }: { tradeId: string; onOpenApiKey: () => void }) {
  const { fetchReflection, regenerateReflection } = useAiReflection();
  const { canAI } = usePlan();
  const { trades } = useTradeStore();
  const breakdownTrade = useJournalStore(s => s.breakdownTrade);
  const [reflection, setReflection] = useState<AiReflection | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setReflection(null);
    fetchReflection(tradeId).then(r => { setReflection(r); setLoading(false); });
  }, [tradeId]);

  const handleGenerate = async () => {
    if (!breakdownTrade) return;
    setGenerating(true);
    const r = await regenerateReflection(breakdownTrade, trades);
    setReflection(r);
    setGenerating(false);
  };

  const gradeColor = (g: string) => g === 'A' ? 'var(--green)' : g === 'B' ? 'var(--gold2)' : g === 'C' ? 'var(--gold)' : 'var(--red)';

  if (loading) return (
    <div className="bd-section bd-span-2">
      <div className="bd-section-title">AI Refleksi</div>
      <div className="bd-ai-loading"><div className="bd-spinner" /><span>Memuat refleksi AI...</span></div>
    </div>
  );

  if (!hasApiKey()) return (
    <div className="bd-section bd-span-2">
      <div className="bd-section-title">AI Refleksi</div>
      <div className="bd-ai-empty">
        <div className="bd-ai-empty-icon">💡</div>
        <p>Hubungkan API key Gemini untuk dapat analisa AI otomatis di setiap trade.</p>
        <button className="btn btn-gold btn-sm" onClick={onOpenApiKey}>🔑 Hubungkan API Key</button>
      </div>
    </div>
  );

  if (!reflection) return (
    <div className="bd-section bd-span-2">
      <div className="bd-section-title">AI Refleksi</div>
      <div className="bd-ai-empty">
        <div className="bd-ai-empty-icon">🤖</div>
        <p>Belum ada analisa AI untuk trade ini.</p>
        {generating
          ? <div className="bd-ai-loading"><div className="bd-spinner" /><span>Menganalisa trade...</span></div>
          : canAI && <button className="btn btn-gold btn-sm" onClick={handleGenerate}>✨ Generate Analisa AI</button>}
      </div>
    </div>
  );

  const genDate = reflection.generated_at
    ? new Date(reflection.generated_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="bd-section bd-span-2">
      <div className="bd-section-title-row">
        <span className="bd-section-title">AI Refleksi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="bd-grade-badge" style={{ background: gradeColor(reflection.grade) + '22', borderColor: gradeColor(reflection.grade), color: gradeColor(reflection.grade) }}>
            Grade: {reflection.grade}
          </span>
          {canAI && <button className="bd-regen-btn" onClick={handleGenerate} disabled={generating} title="Analisa Ulang">{generating ? '⏳' : '🔄'}</button>}
        </div>
      </div>
      <div className="bd-ai-content">
        {reflection.visual && reflection.visual !== '-' && <div className="bd-ai-block"><div className="bd-ai-block-title">Analisa Visual</div><p className="bd-ai-block-text">{reflection.visual}</p></div>}
        <div className="bd-ai-block"><div className="bd-ai-block-title">Validasi Strategi</div><p className="bd-ai-block-text">{reflection.strategy_check}</p></div>
        <div className="bd-ai-block"><div className="bd-ai-block-title">Pola dari Historis Kamu</div><p className="bd-ai-block-text">{reflection.pattern}</p></div>
        {reflection.suggestions?.length > 0 && (
          <div className="bd-ai-block">
            <div className="bd-ai-block-title">Saran Konkret</div>
            <ul className="bd-ai-suggestions">{reflection.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        <div className="bd-ai-block"><div className="bd-ai-block-title">Alasan Grade {reflection.grade}</div><p className="bd-ai-block-text">{reflection.grade_reason}</p></div>
        <div className="bd-ai-generated">Generated: {genDate}</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TradeBreakdown() {
  const { breakdownTrade, breakdownList, breakdownIndex, closeBreakdown, setBreakdownIndex } = useJournalStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const [currency, setCurrency] = useState('IDR');
  const [mistake, setMistake] = useState('');
  const [solution, setSolution] = useState('');
  const [savingRefleksi, setSavingRefleksi] = useState(false);
  const [savedRefleksi, setSavedRefleksi] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);
  const swipeRef = useRef({ startX: 0, dragging: false, moved: false });

  const handlePointerDown = (e: React.PointerEvent, count: number) => {
    if (count < 2) return;
    swipeRef.current = { startX: e.clientX, dragging: true, moved: false };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swipeRef.current.dragging) return;
    if (Math.abs(e.clientX - swipeRef.current.startX) > 6) swipeRef.current.moved = true;
  };
  const handlePointerUp = (e: React.PointerEvent, count: number) => {
    if (!swipeRef.current.dragging) return;
    const dx = e.clientX - swipeRef.current.startX;
    swipeRef.current.dragging = false;
    if (Math.abs(dx) > 45) {
      if (dx < 0) setFotoIdx(i => Math.min(count - 1, i + 1));
      else setFotoIdx(i => Math.max(0, i - 1));
    }
  };
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenStore = !!breakdownTrade;
  const tradeId = breakdownTrade?.id;

  // 1) Buka: render dulu dalam kondisi tertutup, 2 frame kemudian pasang class open
  useEffect(() => {
    if (!isOpenStore) { setVisible(false); setExpanded(false); return; }
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [isOpenStore]);

  // 2) Reset data tiap trade berganti (buka / prev / next)
  useEffect(() => {
    if (!tradeId) return;
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; setVisible(true); }
    let cancelled = false;
    setCurrency(getCurrency());
    setMistake('');
    setSolution('');
    setSavedRefleksi(false);
    setFotoIdx(0);
    panelRef.current?.scrollTo({ top: 0 });
    _sb.from('trades').select('mistake,solution').eq('id', tradeId).single().then(({ data }) => {
      if (cancelled || !data) return;
      setMistake(data.mistake || '');
      setSolution(data.solution || '');
    });
    return () => { cancelled = true; };
  }, [tradeId]);

  const handleClose = useCallback(() => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { closeTimer.current = null; closeBreakdown(); }, 350);
  }, [closeBreakdown]);

  // 3) Escape + kunci scroll body hanya saat modal terbuka
  useEffect(() => {
    if (!isOpenStore) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [isOpenStore, handleClose]);

  const handleSaveRefleksi = async () => {
    if (!breakdownTrade) return;
    setSavingRefleksi(true);
    try {
      await _sb.from('trades').update({ mistake, solution }).eq('id', breakdownTrade.id);
      setSavedRefleksi(true);
      setTimeout(() => setSavedRefleksi(false), 2000);
    } catch (e) { console.warn('[TradeBreakdown] save error:', e); }
    finally { setSavingRefleksi(false); }
  };

  const trade = breakdownTrade;
  const isOpen = visible;

  if (!trade) return null;

  const isProfit = trade.result === 'Profit';
  const plColor = isProfit ? 'var(--green)' : 'var(--red)';
  const hasFoto = Array.isArray(trade.fotoAnalisa) && trade.fotoAnalisa.length > 0;
  const fotos = hasFoto ? trade.fotoAnalisa : [];
  const metodeChips = (trade.metode || trade.strategi || '').split(',').map(s => s.trim()).filter(Boolean);
  const canPrev = breakdownIndex > 0;
  const canNext = breakdownIndex < breakdownList.length - 1;

  return (
    <div className={'bd-overlay' + (isOpen ? ' bd-open' : '') + (expanded ? ' bd-full' : ' bd-peek')} role="dialog" aria-modal="true" aria-label="Trade Breakdown" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bd-panel" ref={panelRef}>

        <div className="bd-header">
          <div className="bd-nav">
            <button
              className="bd-nav-btn bd-expand-btn"
              onClick={() => setExpanded(v => !v)}
              aria-label={expanded ? 'Kembali ke tampilan ringkas' : 'Buka halaman penuh'}
              title={expanded ? 'Kecilkan' : 'Halaman penuh'}
            >
              {expanded
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>}
            </button>
            <span className="bd-nav-sep" />
            <button className="bd-nav-btn" disabled={!canPrev} onClick={() => setBreakdownIndex(breakdownIndex - 1)}>←</button>
            <span className="bd-nav-count">{breakdownIndex + 1} / {breakdownList.length}</span>
            <button className="bd-nav-btn" disabled={!canNext} onClick={() => setBreakdownIndex(breakdownIndex + 1)}>→</button>
          </div>
          <div className="bd-header-title">Trade Breakdown</div>
          <button className="bd-close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="bd-body">

          {hasFoto ? (
            <div className="bd-cover bd-span-2">
              <img
                src={fotos[fotoIdx]}
                alt="Analisa"
                className="bd-cover-img"
                draggable={false}
                onPointerDown={(e) => handlePointerDown(e, fotos.length)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, fotos.length)}
                onClick={() => { if (swipeRef.current.moved) { swipeRef.current.moved = false; return; } window.dispatchEvent(new CustomEvent('jz:openFoto', { detail: fotos[fotoIdx] })); }}
              />
              <div className="bd-cover-scrim" />
              <div className="bd-cover-content">
                <div className="bd-cover-top">
                  <div className="bd-cover-tags">
                    <span className="bd-hero-tag">{trade.posisi || '—'}</span>
                    <span className={'bd-hero-tag bd-hero-result ' + (isProfit ? 'is-profit' : 'is-loss')}>
                      <i className="bd-dot" />{trade.result || '—'}
                    </span>
                  </div>
                  {fotos.length > 1 && (
                    <div className="bd-cover-nav">
                      <button className="bd-foto-arrow" onClick={(e) => { e.stopPropagation(); setFotoIdx(i => Math.max(0, i - 1)); }} disabled={fotoIdx === 0}>←</button>
                      <span className="bd-cover-nav-count">{fotoIdx + 1}/{fotos.length}</span>
                      <button className="bd-foto-arrow" onClick={(e) => { e.stopPropagation(); setFotoIdx(i => Math.min(fotos.length - 1, i + 1)); }} disabled={fotoIdx === fotos.length - 1}>→</button>
                    </div>
                  )}
                </div>
                <div className="bd-cover-bottom">
                  <div className="bd-cover-main">
                    <h2 className="bd-hero-pair">{trade.pair || '—'}</h2>
                    <div className="bd-hero-meta">
                      {[fmtDate(trade.tanggal), trade.sesi, trade.metode || trade.strategi].filter(Boolean).map((m, i) => (
                        <span key={i}>{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bd-hero-pl" style={{ color: plColor }}>{fmtMoney(trade._pl, currency)}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bd-section bd-span-2 bd-section-slim">
                <div className="bd-section-title">Foto Analisa</div>
                <div className="bd-empty-field">Belum ada foto analisa untuk trade ini</div>
              </div>

              <div className="bd-hero bd-span-2">
                <div className="bd-hero-eyebrow">
                  <span className="bd-hero-tag">{trade.posisi || '—'}</span>
                  <span className={'bd-hero-tag bd-hero-result ' + (isProfit ? 'is-profit' : 'is-loss')}>
                    <i className="bd-dot" />{trade.result || '—'}
                  </span>
                </div>
                <div className="bd-hero-main">
                  <h2 className="bd-hero-pair">{trade.pair || '—'}</h2>
                  <div className="bd-hero-pl" style={{ color: plColor }}>{fmtMoney(trade._pl, currency)}</div>
                </div>
                <div className="bd-hero-meta">
                  {[fmtDate(trade.tanggal), trade.sesi, trade.metode || trade.strategi].filter(Boolean).map((m, i) => (
                    <span key={i}>{m}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="bd-section">
            <div className="bd-section-title">Price Map</div>
            <PriceMap trade={trade} />
          </div>

          <div className="bd-section">
            <div className="bd-section-title">Trade Metrics</div>
            <div className="bd-metrics-grid">
              <div className="bd-metric-card"><div className="bd-metric-lbl">Pips</div><div className="bd-metric-val" style={{ color: isProfit ? 'var(--green)' : 'var(--red)' }}>{trade.pips != null ? Math.abs(trade.pips).toFixed(2) : '—'}</div></div>
              <div className="bd-metric-card"><div className="bd-metric-lbl">Lot</div><div className="bd-metric-val">{trade.lot ?? '—'}</div></div>
              <div className="bd-metric-card"><div className="bd-metric-lbl">R:R</div><div className="bd-metric-val" style={{ color: trade.rr != null ? (trade.rr >= 1 ? 'var(--green)' : trade.rr >= 0.5 ? 'var(--gold2)' : 'var(--red)') : 'inherit' }}>{trade.rr != null ? '1:' + trade.rr.toFixed(2) : '—'}</div></div>
              <div className="bd-metric-card"><div className="bd-metric-lbl">Risk Level</div><div className="bd-metric-val" style={{ fontSize: 11, color: trade.riskLevel === 'HIGH RISK' ? 'var(--red)' : trade.riskLevel === 'LOW RISK' ? 'var(--green)' : 'var(--gold2)' }}>{trade.riskLevel || '—'}</div></div>
              <div className="bd-metric-card"><div className="bd-metric-lbl">Sesi</div><div className="bd-metric-val">{trade.sesi || '—'}</div></div>
              <div className="bd-metric-card"><div className="bd-metric-lbl">Emosi</div><div className="bd-metric-val" style={{ fontSize: 11, color: trade.emosiKontrol === 'Emosi' ? 'var(--red)' : trade.emosiKontrol === 'Aman' ? 'var(--green)' : 'var(--blue)' }}>{trade.emosiKontrol || '—'}</div></div>
            </div>
          </div>

          <div className="bd-section">
            <div className="bd-section-title">Jurnal &amp; Reasoning</div>
            <div className="bd-journal">
              <div className="bd-journal-row"><div className="bd-journal-lbl">Reason Entry</div><div className="bd-journal-val">{trade.reason || <span className="bd-dash">—</span>}</div></div>
              <div className="bd-journal-row"><div className="bd-journal-lbl">Reasoning Fibonacci</div><div className="bd-journal-val">{trade.reasonFib || <span className="bd-dash">—</span>}</div></div>
              <div className="bd-journal-row"><div className="bd-journal-lbl">Custom Reasoning</div><div className="bd-journal-val">{trade.reasonCustom || <span className="bd-dash">—</span>}</div></div>
              <div className="bd-journal-row">
                <div className="bd-journal-lbl">Strategi / Metode</div>
                <div className="bd-journal-val">
                  {metodeChips.length > 0
                    ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{metodeChips.map(m => <span key={m} className="chip chip-gold" style={{ fontSize: 10 }}>{m}</span>)}</div>
                    : <span className="bd-dash">—</span>}
                </div>
              </div>
              <div className="bd-journal-row"><div className="bd-journal-lbl">Emosi &amp; Kontrol</div><div className="bd-journal-val">{trade.emosiKontrol || <span className="bd-dash">—</span>}</div></div>
              <div className="bd-journal-row"><div className="bd-journal-lbl">Catatan Tambahan</div><div className="bd-journal-val">{trade.catatan || <span className="bd-dash">—</span>}</div></div>
            </div>
          </div>

          <div className="bd-section">
            <div className="bd-section-title">Refleksi Pribadi</div>
            <div className="bd-refleksi">
              <div className="bd-refleksi-field">
                <label className="bd-refleksi-lbl">Kesalahan di Trade Ini</label>
                <textarea className="bd-refleksi-textarea" placeholder="Tulis kesalahan kamu..." value={mistake} onChange={e => { setMistake(e.target.value); setSavedRefleksi(false); }} rows={3} />
              </div>
              <div className="bd-refleksi-field">
                <label className="bd-refleksi-lbl">Solusi &amp; Rencana Perbaikan</label>
                <textarea className="bd-refleksi-textarea" placeholder="Tulis solusi kamu..." value={solution} onChange={e => { setSolution(e.target.value); setSavedRefleksi(false); }} rows={3} />
              </div>
              <div className="bd-refleksi-actions">
                <button className="btn btn-gold btn-sm" onClick={handleSaveRefleksi} disabled={savingRefleksi}>
                  {savingRefleksi ? '⏳ Menyimpan...' : '💾 Simpan Refleksi'}
                </button>
                {savedRefleksi && <span className="bd-saved-indicator">✓ Tersimpan</span>}
              </div>
            </div>
          </div>

          <AiSection tradeId={trade.id} onOpenApiKey={() => window.dispatchEvent(new CustomEvent('jz:openApiKeyModal'))} />

        </div>
      </div>
    </div>
  );
}
