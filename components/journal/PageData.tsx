// components/journal/PageData.tsx — Phase 6 (full rewrite, 1:1 index.html)
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJournalStore } from '@/store/useJournalStore';
import { useTradeStore, recalcAll } from '@/store/useTradeStore';
import {
  liveRates, calcPips, calcPL, idrToDisp, fmtDispCur, fmtMoney, inputToIDR,
  getTipeAkun,
  type Currency,
} from '@/lib/riskCalc';
import type { Trade, DW } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRiskState() {
  try {
    const s = JSON.parse(localStorage.getItem('jz_state') || 'null');
    return s || { balance: 0, target: 0, pair: 'XAUUSD', currency: 'IDR', risk: 1, months: 1, leverage: 500, tipeAkun: '—' };
  } catch { return { balance: 0, target: 0, pair: 'XAUUSD', currency: 'IDR', risk: 1, months: 1, leverage: 500, tipeAkun: '—' }; }
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function calcStreak(trades: Trade[]) {
  const sorted = [...trades].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1);
  let maxW = 0, maxL = 0, cW = 0, cL = 0;
  sorted.forEach(t => {
    if (t.result === 'Profit') { cW++; cL = 0; maxW = Math.max(maxW, cW); }
    else { cL++; cW = 0; maxL = Math.max(maxL, cL); }
  });
  return { win: maxW, loss: maxL };
}

const PAIRS = ['XAUUSD', 'USDJPY', 'BTCUSD', 'GBPUSD', 'NASDAQ'];
const METODE_LIST = [
  { v: 'SMC', l: 'SMC' }, { v: 'SNR', l: 'SNR' }, { v: 'SND', l: 'SND' },
  { v: 'ICT', l: 'ICT' }, { v: 'ELMETHOD', l: 'EL' }, { v: 'ALCHEMIST', l: 'ALCH' },
  { v: 'SINYAL', l: 'SINYAL' }, { v: 'TRENDLINE', l: 'TREND' }, { v: 'FIBONACCI', l: 'FIB' },
  { v: 'DOJI', l: 'DOJI' }, { v: 'IKUT ALUR', l: 'ALUR' }, { v: 'BE+', l: 'BE+' },
  { v: 'TDK DICATAT', l: 'TDK' },
];

// ── ChipGroup ─────────────────────────────────────────────────────────────────

function ChipGroup({ options, value, onSelect, multi = false, colorMap = {} }: {
  options: { v: string; l: string }[];
  value: string | string[];
  onSelect: (v: string) => void;
  multi?: boolean;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="chip-group">
      {options.map((o) => {
        const active = multi ? (value as string[]).includes(o.v) : value === o.v;
        return (
          <div key={o.v} className={`chip-opt${active ? ' sel' + (colorMap[o.v] ? ' ' + colorMap[o.v] : '') : ''}`} onClick={() => onSelect(o.v)}>
            {o.l}
          </div>
        );
      })}
    </div>
  );
}

// ── TradeForm type ────────────────────────────────────────────────────────────

interface TradeForm {
  id: string; tanggal: string; sesi: string; pair: string; posisi: string;
  lot: string; entry: string; close: string; sl: string; tp: string;
  result: string; catatan: string; metode: string[];
  riskLevel: string; emosiKontrol: string;
  reason: string; reasonFib: string; reasonCustom: string;
  fotoAnalisa: string[];
}

function emptyForm(): TradeForm {
  return { id: '', tanggal: todayStr(), sesi: '', pair: '', posisi: '', lot: '', entry: '', close: '', sl: '', tp: '', result: '', catatan: '', metode: [], riskLevel: '', emosiKontrol: '', reason: '', reasonFib: '', reasonCustom: '', fotoAnalisa: [] };
}

function tradeToForm(t: Trade): TradeForm {
  return {
    id: t.id, tanggal: t.tanggal, sesi: t.sesi, pair: t.pair, posisi: t.posisi,
    lot: t.lot?.toString() || '', entry: t.entry?.toString() || '',
    close: t.close?.toString() || '', sl: t.sl?.toString() || '', tp: t.tp?.toString() || '',
    result: t.result, catatan: t.catatan,
    metode: (t.metode || '').split(',').map(s => s.trim()).filter(Boolean),
    riskLevel: t.riskLevel, emosiKontrol: t.emosiKontrol,
    reason: t.reason, reasonFib: t.reasonFib, reasonCustom: t.reasonCustom,
    fotoAnalisa: t.fotoAnalisa || [],
  };
}

// ── TradeModal ────────────────────────────────────────────────────────────────

// ── REASON_MAP — 1:1 index.html ──────────────────────────────────────────────
const REASON_MAP: Record<string, { v: string; l: string }[]> = {
  SMC:       [{ v: 'BOS', l: 'BOS' }, { v: 'CHoCH', l: 'CHoCH' }, { v: 'FVG', l: 'FVG' }, { v: 'OB', l: 'OB' }, { v: 'Liquidity Grab', l: 'Liq.Grab' }, { v: 'MSS', l: 'MSS' }],
  SNR:       [{ v: 'Support', l: 'Support' }, { v: 'Resisten', l: 'Resisten' }, { v: 'SBR', l: 'SBR' }, { v: 'RBS', l: 'RBS' }],
  SND:       [{ v: 'Supply Zone', l: 'Supply' }, { v: 'Demand Zone', l: 'Demand' }, { v: 'Flip Zone', l: 'Flip Zone' }],
  ICT:       [{ v: 'Killzone', l: 'Killzone' }, { v: 'SIBI/BISI', l: 'SIBI/BISI' }, { v: 'Liquidity', l: 'Liquidity' }, { v: 'Breaker Block', l: 'Breaker' }, { v: 'IPDA', l: 'IPDA' }],
  ELMETHOD:  [{ v: 'Agresif Entry', l: 'Agresif' }, { v: 'Konfirmasi Entry', l: 'Konfirmasi' }, { v: 'Setup High', l: 'Setup High' }, { v: 'Setup Low', l: 'Setup Low' }],
  ALCHEMIST: [{ v: 'Liquidity Sweep', l: 'Liq.Sweep' }, { v: 'MSS', l: 'MSS' }, { v: 'BOS', l: 'BOS' }, { v: 'OB Retest', l: 'OB Retest' }, { v: 'FVG Fill', l: 'FVG Fill' }],
  SINYAL:    [{ v: 'Sinyal Komunitas', l: 'Komunitas' }, { v: 'Sinyal Provider', l: 'Provider' }, { v: 'Copy Trade', l: 'Copy Trade' }],
  TRENDLINE: [{ v: 'Trend Bounce', l: 'Bounce' }, { v: 'Trend Break', l: 'Break' }, { v: 'Channel', l: 'Channel' }],
  FIBONACCI: [],
  DOJI:      [{ v: 'Reversal Doji', l: 'Reversal' }, { v: 'Indecision', l: 'Indecision' }, { v: 'Pin Bar', l: 'Pin Bar' }],
  'IKUT ALUR': [{ v: 'Momentum', l: 'Momentum' }, { v: 'Breakout', l: 'Breakout' }, { v: 'Continuation', l: 'Continuation' }],
  'BE+': [],
  'TDK DICATAT': [],
};
const NO_REASON = ['TDK DICATAT', 'BE+'];

// ── TradeModal — 1:1 index.html ───────────────────────────────────────────────
function TradeModal({ form, setForm, onSave, onClose, currency }: {
  form: TradeForm; setForm: (f: TradeForm) => void;
  onSave: () => void; onClose: () => void; currency: Currency;
}) {
  const kurs = liveRates.USD_IDR || 16462;
  const isEdit = !!form.id;
  const set = (k: keyof TradeForm, v: string | string[]) => setForm({ ...form, [k]: v });

  // ── Upload foto (OCR top) ──
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // ── Foto Analisa ──
  const [fotoOpen, setFotoOpen] = useState(false);
  const [fotoAnalisa, setFotoAnalisa] = useState<string[]>(form.fotoAnalisa || []);

  // ── Reason block ──
  const selectedMetode = form.metode;
  const showReason = selectedMetode.length > 0 && !selectedMetode.every(m => NO_REASON.includes(m));
  const hasFib = selectedMetode.includes('FIBONACCI');
  const hasAlchemist = selectedMetode.includes('ALCHEMIST');
  const reasonChips = (() => {
    const chips: { v: string; l: string }[] = [];
    selectedMetode.forEach(m => {
      if (NO_REASON.includes(m) || m === 'FIBONACCI') return;
      (REASON_MAP[m] || []).forEach(r => { if (!chips.find(c => c.v === r.v)) chips.push(r); });
    });
    return chips;
  })();
  const reasonLabel = '📌 Reason — ' + selectedMetode
    .filter(m => !NO_REASON.includes(m))
    .map(m => m === 'FIBONACCI' ? 'FIB' : m === 'ELMETHOD' ? 'EL' : m === 'ALCHEMIST' ? 'ALCH' : m)
    .join(', ');

  const toggleMetode = (v: string) => {
    const arr = form.metode.includes(v) ? form.metode.filter(m => m !== v) : [...form.metode, v];
    // Hanya hapus reason yang sudah tidak relevan — reason dari metode yang masih aktif tetap dipertahankan
    const validReasonVals = new Set(
      arr.flatMap(m => (REASON_MAP[m] || []).map(r => r.v))
    );
    const curReasons = (form.reason || '').split(',').map(s => s.trim()).filter(Boolean);
    const filteredReasons = curReasons.filter(r => validReasonVals.has(r));
    const hasFibNext = arr.includes('FIBONACCI');
    const hasAlchNext = arr.includes('ALCHEMIST');
    setForm({
      ...form,
      metode: arr,
      reason: filteredReasons.join(', '),
      reasonFib: hasFibNext ? form.reasonFib : '',
      reasonCustom: hasAlchNext ? form.reasonCustom : '',
    });
  };
  const toggleReason = (v: string) => {
    const cur = (form.reason || '').split(',').map(s => s.trim()).filter(Boolean);
    const next = cur.includes(v) ? cur.filter(r => r !== v) : [...cur, v];
    set('reason', next.join(', '));
  };
  const selectedReasons = (form.reason || '').split(',').map(s => s.trim()).filter(Boolean);

  // ── Pip value ──
  const getPipValueDisplay = (pair: string, cur: Currency): string => {
    if (!pair) return '—';
    const pipUSD: Record<string, number> = { XAUUSD: 0.10, USDJPY: 0.0091, BTCUSD: 1.00, GBPUSD: 0.10, NASDAQ: 0.10 };
    const pv = pipUSD[pair] ?? 0.10;
    if (cur === 'CENT') return (pv * 100).toFixed(2) + '¢ per 0.01 lot';
    if (cur === 'USD') return '$' + pv.toFixed(2) + ' per 0.01 lot';
    return 'Rp ' + Math.round(pv * kurs).toLocaleString('id-ID') + ' per 0.01 lot';
  };

  // ── Live preview calc ──
  const entry = parseNum(form.entry), close = parseNum(form.close);
  const sl = parseNum(form.sl), tp = parseNum(form.tp), lot = parseNum(form.lot);
  const pips = entry && close && form.pair && form.result ? calcPips(entry, close, form.pair, form.result) : null;
  const pl = pips != null && lot && form.pair ? calcPL(pips, lot, form.pair, currency) : null;

  let rrVal: number | null = null;
  let rrSrc = '';
  if (entry && close && form.result) {
    const hasSL = sl !== null && sl !== 0, hasTP = tp !== null && tp !== 0;
    if (hasSL && hasTP) {
      const riskPips = Math.abs(entry - sl!), rewardTP = Math.abs(tp! - entry);
      const tpTol = Math.abs(tp! - entry) * 0.001;
      const closeMatchesTP = Math.abs(close - tp!) <= tpTol;
      if (riskPips > 0) {
        if (closeMatchesTP) { rrVal = rewardTP / riskPips; rrSrc = 'SL & TP'; }
        else { rrVal = Math.abs(close - entry) / riskPips; rrSrc = 'Close & SL'; }
      }
    } else { rrVal = form.result === 'Profit' ? 2.0 : 0.5; rrSrc = 'Default'; }
  }
  const rrColor = rrVal != null ? (rrVal >= 1 ? 'var(--green)' : rrVal >= 0.5 ? 'var(--gold2)' : 'var(--red)') : 'inherit';

  // ── Foto handler ──
  const handleUploadFoto = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const b64 = e.target?.result as string;
        setFotoAnalisa(prev => {
          const next = [...prev, b64];
          setForm({ ...form, fotoAnalisa: next });
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // ── OCR upload handler (top photo) ──
  const handleOcrUpload = (files: FileList | null) => {
    if (!files) return;
    const previews: string[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        previews.push(e.target?.result as string);
        if (previews.length === files.length) setUploadPreviews(prev => [...prev, ...previews]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="overlay open" id="trade-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title" id="modal-ttl">{isEdit ? 'Edit Trade' : 'Tambah Trade Baru'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* ── UPLOAD FOTO OCR (top) ── */}
          <div className="fg" style={{ marginBottom: '12px' }}>
            <label className="flabel">📷 Upload Screenshot Trade (bisa buat ngisi otomatis)</label>
            <div className="upload-zone" id="upload-zone" onClick={() => ocrInputRef.current?.click()}>
              <div className="upload-zone-icon">🖼️</div>
              <div className="upload-zone-text">
                Klik untuk upload foto dari MT4/MT5<br />
                <strong>Sistem akan otomatis baca data trade dari foto</strong>
              </div>
            </div>
            <input ref={ocrInputRef} type="file" accept="image/*" multiple style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} onChange={e => handleOcrUpload(e.target.files)} />
            {aiStatus && (
              <div className="ai-status">
                <div className="ai-dot" />
                <span>{aiStatus}</span>
              </div>
            )}
            {uploadPreviews.length > 0 && (
              <div className="photo-list">
                {uploadPreviews.map((src, i) => (
                  <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={src} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--gold-bd)' }} alt="" />
                    <button onClick={() => setUploadPreviews(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--red)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="div" />

          {/* ── FORM FIELDS ── */}
          <div className="frow">
            <div className="fg"><label className="flabel">📅 Tanggal</label><input type="date" className="finput" id="f-tgl" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} /></div>
            <div className="fg">
              <label className="flabel">🌏 Sesi Market</label>
              <div className="chip-group" id="cg-sesi">
                {['Asia', 'London', 'US'].map(v => (
                  <div key={v} className={`chip-opt${form.sesi === v ? ' sel' : ''}`} onClick={() => set('sesi', v)}>{v}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="frow">
            <div className="fg">
              <label className="flabel">💱 Pair</label>
              <div className="chip-group" id="cg-pair">
                {PAIRS.map(v => (
                  <div key={v} className={`chip-opt${form.pair === v ? ' sel' : ''}`} onClick={() => set('pair', v)}>{v}</div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="flabel">📍 Posisi</label>
              <div className="chip-group" id="cg-pos">
                <div className={`chip-opt${form.posisi === 'Buy' ? ' sel-buy' : ''}`} onClick={() => set('posisi', 'Buy')}>Buy</div>
                <div className={`chip-opt${form.posisi === 'Sell' ? ' sel-sell' : ''}`} onClick={() => set('posisi', 'Sell')}>Sell</div>
              </div>
            </div>
          </div>

          <div className="frow f3">
            <div className="fg"><label className="flabel">Lot</label><input type="number" className="finput" id="f-lot" placeholder="0.01" step="0.01" value={form.lot} onChange={e => set('lot', e.target.value)} /></div>
            <div className="fg"><label className="flabel">Entry Price</label><input type="number" className="finput" id="f-entry" placeholder="2350.00" step="any" value={form.entry} onChange={e => set('entry', e.target.value)} /></div>
            <div className="fg"><label className="flabel">Close Price</label><input type="number" className="finput" id="f-close" placeholder="2365.00" step="any" value={form.close} onChange={e => set('close', e.target.value)} /></div>
          </div>

          <div className="frow">
            <div className="fg"><label className="flabel">Stop Loss</label><input type="number" className="finput" id="f-sl" placeholder="— atau kosongkan" step="any" value={form.sl} onChange={e => set('sl', e.target.value)} /></div>
            <div className="fg"><label className="flabel">Take Profit</label><input type="number" className="finput" id="f-tp" placeholder="— atau kosongkan" step="any" value={form.tp} onChange={e => set('tp', e.target.value)} /></div>
          </div>

          <div className="frow">
            <div className="fg">
              <label className="flabel">📊 Result</label>
              <div className="chip-group" id="cg-res">
                <div className={`chip-opt${form.result === 'Profit' ? ' sel-profit' : ''}`} onClick={() => set('result', 'Profit')}>Profit</div>
                <div className={`chip-opt${form.result === 'Lose' ? ' sel-lose' : ''}`} onClick={() => set('result', 'Lose')}>Lose</div>
              </div>
            </div>
          </div>

          {/* ── METODE ── */}
          <div className="modal-section">
            <div className="modal-section-title">🎯 Metode Trading</div>
            <div className="fg">
              <label className="flabel">Pilih metode — bisa lebih dari 1</label>
              <div className="chip-group" id="cg-metode">
                {METODE_LIST.map(o => (
                  <div key={o.v} className={`chip-opt${form.metode.includes(o.v) ? ' sel' : ''}`} onClick={() => toggleMetode(o.v)}>{o.l}</div>
                ))}
              </div>
            </div>

            {/* REASON BLOCK — muncul dinamis sesuai metode */}
            {showReason && (
              <div className="reason-block visible" id="reason-block">
                <div className="reason-block-label" id="reason-block-label">{reasonLabel}</div>
                <div className="chip-group" id="cg-reason">
                  {reasonChips.map(r => (
                    <div key={r.v} className={`chip-opt${selectedReasons.includes(r.v) ? ' sel' : ''}`} onClick={() => toggleReason(r.v)}>{r.l}</div>
                  ))}
                </div>
                {hasFib && (
                  <input type="text" className="reason-fib-input" id="reason-fib-input"
                    placeholder="Tulis level fibonacci (contoh: 0.618, ekstensi...)"
                    value={form.reasonFib} onChange={e => set('reasonFib', e.target.value)} />
                )}
                {hasAlchemist && (
                  <input type="text" className="reason-fib-input" id="reason-custom-input"
                    placeholder="Reason lainnya (opsional)..."
                    style={{ marginTop: '6px' }}
                    value={form.reasonCustom} onChange={e => set('reasonCustom', e.target.value)} />
                )}
              </div>
            )}
          </div>

          {/* ── PSIKOLOGI & RISK ── */}
          <div className="modal-section">
            <div className="modal-section-title">🧠 Psikologi &amp; Risk</div>
            <div className="frow">
              <div className="fg">
                <label className="flabel">⚠️ Risk Level</label>
                <div className="chip-group" id="cg-risklevel">
                  <div className={`chip-opt${form.riskLevel === 'HIGH RISK' ? ' sel-hr' : ''}`} onClick={() => set('riskLevel', 'HIGH RISK')}>High Risk</div>
                  <div className={`chip-opt${form.riskLevel === 'MIDDLE RISK' ? ' sel-mr' : ''}`} onClick={() => set('riskLevel', 'MIDDLE RISK')}>Middle Risk</div>
                  <div className={`chip-opt${form.riskLevel === 'LOW RISK' ? ' sel-lr' : ''}`} onClick={() => set('riskLevel', 'LOW RISK')}>Low Risk</div>
                </div>
              </div>
              <div className="fg">
                <label className="flabel">🧘 Kontrol Emosi</label>
                <div className="chip-group" id="cg-emosi">
                  <div className={`chip-opt${form.emosiKontrol === 'Emosi' ? ' sel-emosi' : ''}`} onClick={() => set('emosiKontrol', 'Emosi')}>Emosi</div>
                  <div className={`chip-opt${form.emosiKontrol === 'Stabil' ? ' sel-stabil' : ''}`} onClick={() => set('emosiKontrol', 'Stabil')}>Stabil</div>
                  <div className={`chip-opt${form.emosiKontrol === 'Aman' ? ' sel-aman' : ''}`} onClick={() => set('emosiKontrol', 'Aman')}>Aman</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FOTO ANALISA (collapsible) ── */}
          {/* Input SELALU ada di DOM — tidak di dalam conditional fotoOpen */}
          {/* Pakai <label htmlFor> bukan ref.click() — paling reliable di semua browser */}
          <input
            id="foto-analisa-input"
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              e.target.value = '';
              files.forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                  const b64 = ev.target?.result as string;
                  setFotoAnalisa(prev => {
                    const next = [...prev, b64];
                    setForm(f => ({ ...f, fotoAnalisa: next }));
                    return next;
                  });
                };
                reader.readAsDataURL(file);
              });
            }}
          />
          <div className="modal-section" style={{ marginTop: '2px' }}>
            <div className="foto-analisa-wrap">
              <div className="foto-analisa-header" onClick={() => setFotoOpen(p => !p)}>
                <div className="foto-analisa-header-left">
                  <div className="foto-analisa-icon">📸</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span className="foto-analisa-title">Foto Analisa</span>
                      {fotoAnalisa.length > 0 && <span className="foto-analisa-badge">{fotoAnalisa.length}</span>}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text3)', marginTop: '1px' }}>Screenshot chart, setup, atau bukti entry</div>
                  </div>
                </div>
                <span className="foto-analisa-toggle">{fotoOpen ? '▲' : '▼'}</span>
              </div>
              {fotoOpen && (
                <div className="foto-analisa-body">
                  {/* label htmlFor — native browser, tidak perlu JS click */}
                  <label htmlFor="foto-analisa-input" className="foto-drop-zone" style={{ display: 'block', cursor: 'pointer' }}>
                    <span className="fdz-icon">🗂️</span>
                    <div className="fdz-title">Upload Foto Analisa</div>
                    <div className="fdz-sub">
                      Screenshot chart, pola, atau setup trade kamu<br />
                      <strong>JPG / PNG / WEBP</strong> — bisa upload lebih dari 1
                    </div>
                  </label>
                  {fotoAnalisa.length === 0 ? (
                    <div className="foto-empty-hint">Belum ada foto ditambahkan</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginTop: '10px' }}>
                      {fotoAnalisa.map((src, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img
                            src={src}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--gold-bd)' }}
                            alt=""
                          />
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              const next = fotoAnalisa.filter((_, j) => j !== i);
                              setFotoAnalisa(next);
                              setForm(f => ({ ...f, fotoAnalisa: next }));
                            }}
                            style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '9px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* ── CATATAN ── */}
          <div className="fg" style={{ marginTop: '10px' }}>
            <label className="flabel">📝 Catatan</label>
            <textarea className="ftextarea" id="f-catatan" placeholder="Analisis, alasan entry, kondisi market..." value={form.catatan} onChange={e => set('catatan', e.target.value)} />
          </div>

          {/* ── LIVE PREVIEW — 1:1 index.html ── */}
          <div className="calc-preview">
            <div className="calc-row">
              <span className="calc-lbl">Jumlah Pips</span>
              <span className="calc-val" id="prev-pips">{pips != null ? Math.abs(pips).toFixed(2) : '—'}</span>
            </div>
            <div className="calc-row">
              <span className="calc-lbl">Pip Value (per 0.01 lot)</span>
              <span className="calc-val blue" id="prev-pv">{form.pair ? getPipValueDisplay(form.pair, currency) : '—'}</span>
            </div>
            <div className="calc-row">
              <span className="calc-lbl">🔒 Kurs dikunci</span>
              <span className="calc-val" id="prev-kurs" style={{ fontSize: '10px', color: 'var(--gold)' }}>Rp {Math.round(kurs).toLocaleString('id-ID')}</span>
            </div>
            <div className="calc-row">
              <span className="calc-lbl" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⚖️ Risk/Reward (RR)
                <span id="prev-rr-src" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '7.5px', color: 'var(--text4)', background: 'var(--bg4)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: '3px' }}>{rrSrc || '—'}</span>
              </span>
              <span className="calc-val" id="prev-rr" style={{ fontSize: '12px', color: rrColor }}>
                {rrVal != null ? '1 : ' + rrVal.toFixed(2) : '—'}
              </span>
            </div>
            <div className="calc-row">
              <span className="calc-lbl" style={{ fontSize: '11px', color: 'var(--text2)' }}>Estimasi P/L</span>
              <span className="calc-val" id="prev-pl" style={{ fontSize: '13px', color: pl != null ? (pl >= 0 ? 'var(--green)' : 'var(--red)') : undefined }}>
                {pl != null ? fmtMoney(pl, currency) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-gold" onClick={onSave}>💾 Simpan Trade</button>
        </div>
      </div>
    </div>
  );
}

function DWModal({ currency, onSave, onClose }: { currency: Currency; onSave: (tgl: string, dep: number, wd: number) => void; onClose: () => void; }) {
  const [tgl, setTgl] = useState(todayStr());
  const [dep, setDep] = useState('');
  const [wd, setWd] = useState('');
  const curLabel = currency === 'CENT' ? '¢' : currency === 'USD' ? '$' : 'Rp';
  return (
    <div className="overlay open" id="dw-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="modal-head"><div className="modal-title">Deposit / Withdraw</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="frow f1" style={{ marginBottom: '10px' }}><div className="fg"><label className="flabel">📅 Tanggal</label><input type="date" className="finput" value={tgl} onChange={e => setTgl(e.target.value)} /></div></div>
          <div className="frow">
            <div className="fg"><label className="flabel">Deposit ({curLabel})</label><input type="number" className="finput" value={dep} placeholder="0" step="any" min="0" onChange={e => setDep(e.target.value)} /></div>
            <div className="fg"><label className="flabel">Withdraw ({curLabel})</label><input type="number" className="finput" value={wd} placeholder="0" step="any" min="0" onChange={e => setWd(e.target.value)} /></div>
          </div>
          <div className="fhint" id="dw-hint" style={{ marginTop: '6px' }}>Isi nominal sesuai mata uang aktif ({currency}).</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-gold" onClick={() => { if (!tgl) return; onSave(tgl, inputToIDR(parseFloat(dep) || 0, currency), inputToIDR(parseFloat(wd) || 0, currency)); }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

// ── PageData ──────────────────────────────────────────────────────────────────

export default function PageData({ active }: { active: boolean }) {
  const currentUser = useJournalStore(s => s.currentUser);
  const showToast = useJournalStore(s => s.showToast);
  const showConfirmModal = useJournalStore(s => s.showConfirmModal);
  const { trades, dwList, loaded, loadLocal, loadCloud, addTrade, updateTrade, deleteTrade, resetTrades, addDW, deleteDW } = useTradeStore();

  const [mounted, setMounted] = useState(false);
  const [rs, setRs] = useState(getRiskState());
  const [currency, setCurrencyState] = useState<Currency>('IDR');
  const [tradeModal, setTradeModal] = useState(false);
  const [dwModal, setDwModal] = useState(false);
  const [form, setForm] = useState<TradeForm>(emptyForm());
  const [pairFilter, setPairFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [undoSnapshot, setUndoSnapshot] = useState<Trade[] | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fotoAnalisaRef = useRef<HTMLInputElement>(null);

  const kurs = liveRates.USD_IDR || 16462;
  const userId = currentUser?.id || null;

  useEffect(() => {
    setMounted(true);
    loadLocal();
    const cur = (localStorage.getItem('jz_currency') as Currency) || 'IDR';
    setCurrencyState(cur);
  }, []);

  useEffect(() => { if (userId) loadCloud(userId); }, [userId]);

  useEffect(() => {
    if (active && mounted) {
      setRs(getRiskState());
      const cur = (localStorage.getItem('jz_currency') as Currency) || 'IDR';
      setCurrencyState(cur);
    }
  }, [active, mounted]);

  const balanceIDR: number = rs.balance || 0;
  const targetIDR: number = rs.target || 0;

  // ── Computed trades ──
  const computedTrades = useMemo(() => {
    if (!mounted) return [];
    return recalcAll(trades, dwList, currency, balanceIDR, kurs);
  }, [trades, dwList, currency, balanceIDR, kurs, mounted]);

  // ── Filtered trades ──
  const filteredTrades = useMemo(() => {
    return computedTrades.filter(t => {
      if (pairFilter && t.pair !== pairFilter) return false;
      if (resultFilter && t.result !== resultFilter) return false;
      return true;
    });
  }, [computedTrades, pairFilter, resultFilter]);

  // ── Stats (pakai computedTrades, bukan filteredTrades — 1:1 renderStats) ──
  const stats = useMemo(() => {
    const all = computedTrades;
    const wins = all.filter(t => t.result === 'Profit');
    const losses = all.filter(t => t.result === 'Lose');
    const totalProfit = wins.reduce((s, t) => s + (t._pl || 0), 0);
    const totalLose = losses.reduce((s, t) => s + (t._pl || 0), 0);
    const totalPL = totalProfit + totalLose;
    const wr = all.length ? Math.round((wins.length / all.length) * 100) : 0;
    const sortedAll = [...all].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1);
    const lastSaldo = sortedAll.length ? (sortedAll[sortedAll.length - 1]._saldo || 0) : 0;
    const avgWin = wins.length ? totalProfit / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(totalLose) / losses.length : 0;
    const profitFactor = totalLose !== 0 ? Math.abs(totalProfit / totalLose) : 0;
    const streak = calcStreak(all);
    const hariTrading = [...new Set(all.map(t => t.tanggal))].length;
    return { totalPL, totalProfit, totalLose, wr, total: all.length, wins: wins.length, losses: losses.length, saldo: lastSaldo, avgWin, avgLoss, profitFactor, streak, hariTrading };
  }, [computedTrades]);

  // ── Progress bar (1:1 renderStats logic) ──
  const balCur = idrToDisp(balanceIDR, currency);
  const tgtCur = idrToDisp(targetIDR, currency);
  const hasData = balCur > 0 && tgtCur > balCur;
  const totalPLcur = stats.totalPL;
  const currentCur = balCur + totalPLcur;
  const baselineWidth = hasData ? Math.min(100, (balCur / tgtCur) * 100) : 0;
  const plWidth = hasData ? (totalPLcur / tgtCur) * 100 : 0;
  const totalWidth = Math.min(100, Math.max(0, baselineWidth + plWidth));
  const progToTarget = hasData ? Math.min(100, Math.max(0, (currentCur / tgtCur) * 100)) : 0;
  const barColor = !hasData || stats.total === 0
    ? 'linear-gradient(90deg,var(--gold),var(--gold3),#f0c040)'
    : totalPLcur >= 0 ? 'linear-gradient(90deg,#22c55e,#4ade80,#86efac)'
    : 'linear-gradient(90deg,var(--gold),var(--gold3),#f0c040)';
  const subLabel = !hasData
    ? 'Saldo awal belum diset di tab Trading Plan'
    : stats.total === 0 ? 'Belum ada trade — saldo awal ' + fmtDispCur(balCur, currency)
    : `Saldo: ${fmtDispCur(currentCur, currency)} (${totalPLcur >= 0 ? '+' : ''}${((totalPLcur / balCur) * 100).toFixed(2)}% dari modal)`;
  const subLabelColor = !hasData || stats.total === 0 ? 'var(--text3)' : totalPLcur > 0 ? 'var(--green)' : totalPLcur < 0 ? 'var(--red)' : 'var(--text3)';

  // ── Rekap Harian (sort desc, fmtDate) ──
  const rekapHarian = useMemo(() => {
    const deduped = [...new Map(computedTrades.map(t => [t.id, t])).values()];
    const dates = [...new Set(deduped.map(t => t.tanggal))].sort().reverse();
    return dates.map(d => {
      const day = deduped.filter(t => t.tanggal === d);
      return { tgl: d, pl: day.reduce((s, t) => s + (t._pl || 0), 0), count: day.length };
    });
  }, [computedTrades]);

  // ── Pair options ──
  const pairOptions = useMemo(() => [...new Set(trades.map(t => t.pair).filter(Boolean))], [trades]);

  const fmt = (v: number) => fmtDispCur(v, currency);
  const fmtPL = (v: number | null | undefined) => v != null ? fmtMoney(v, currency) : '—';

  // ── Handlers ──
  const openAddModal = () => { setForm(emptyForm()); setTradeModal(true); };
  const openEditModal = (t: Trade) => { setForm(tradeToForm(t)); setTradeModal(true); };

  const handleSaveTrade = useCallback(async () => {
    const { tanggal, lot, entry, close, pair, posisi, result } = form;
    if (!tanggal) { showToast('Tanggal harus diisi', 'error'); return; }
    if (!parseNum(lot) || (parseNum(lot) || 0) <= 0) { showToast('Lot harus diisi', 'error'); return; }
    if (parseNum(entry) === null) { showToast('Entry price harus diisi', 'error'); return; }
    if (parseNum(close) === null) { showToast('Close price harus diisi', 'error'); return; }
    if (!pair) { showToast('Pilih pair', 'error'); return; }
    if (!posisi) { showToast('Pilih posisi', 'error'); return; }
    if (!result) { showToast('Pilih result', 'error'); return; }

    const entryN = parseNum(entry)!, closeN = parseNum(close)!;
    const slN = parseNum(form.sl), tpN = parseNum(form.tp), lotN = parseNum(lot)!;
    const pips = calcPips(entryN, closeN, pair, result);
    const kursSnap = liveRates.USD_IDR || 16462;

    let rrValue: number | null = null;
    if (slN && tpN) {
      const riskP = Math.abs(entryN - slN), rewardP = Math.abs(tpN - entryN);
      const closeMatchesTP = Math.abs(closeN - tpN) <= Math.abs(tpN - entryN) * 0.001;
      if (riskP > 0) rrValue = closeMatchesTP ? rewardP / riskP : Math.abs(closeN - entryN) / riskP;
    } else { rrValue = result === 'Profit' ? 2.0 : 0.5; }

    const isEdit = !!form.id;
    const existing = isEdit ? trades.find(t => t.id === form.id) : null;
    const seqValue = existing ? (existing.seq ?? parseInt(existing.id) ?? Date.now()) : Date.now();

    const trade: Trade = {
      id: form.id || crypto.randomUUID(),
      seq: seqValue, tanggal, sesi: form.sesi, pair, posisi, lot: lotN,
      entry: entryN, sl: slN, tp: tpN, close: closeN, result, pips,
      kurs: kursSnap, rr: rrValue,
      metode: form.metode.join(', '), strategi: form.metode.join(', '),
      reason: form.reason, reasonFib: form.reasonFib, reasonCustom: form.reasonCustom,
      catatan: form.catatan, riskLevel: form.riskLevel, emosiKontrol: form.emosiKontrol,
      source: 'manual', photos: uploadPreviews.length ? uploadPreviews : (existing?.photos || []), fotoAnalisa: form.fotoAnalisa || [],
    };

    if (isEdit) { await updateTrade(trade, userId); showToast('Trade diperbarui ✓', 'success'); }
    else { await addTrade(trade, userId); showToast('Trade ditambahkan ✓', 'success'); }
    setTradeModal(false);
  }, [form, trades, userId, addTrade, updateTrade, showToast]);

  const handleDeleteTrade = (id: string) => {
    showConfirmModal('🗑️ Hapus Trade', 'Trade ini akan dihapus permanen.<br>Tindakan ini tidak bisa dibatalkan.', 'Hapus',
      async () => { await deleteTrade(id, userId); showToast('Trade dihapus', 'success'); });
  };

  const handleResetTrades = () => {
    setUndoSnapshot([...trades]);
    showConfirmModal('🗑️ Reset Data Trading', 'Semua data trade akan dihapus permanen.', 'Reset Sekarang',
      async () => { await resetTrades(userId); showToast('Data direset', 'success'); });
  };

  const handleSaveDW = async (tgl: string, depIDR: number, wdIDR: number) => {
    if (!tgl) { showToast('Tanggal harus diisi', 'error'); return; }
    if (!depIDR && !wdIDR) { showToast('Isi deposit atau withdraw', 'error'); return; }
    const dw: DW = { id: crypto.randomUUID(), tanggal: tgl, deposit: depIDR, withdraw: wdIDR };
    await addDW(dw, userId);
    setDwModal(false);
    showToast('Disimpan ✓', 'success');
  };

  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-data" />;

  return (
    <>
      <div className={`page${active ? ' active' : ''}`} id="page-data">

        {/* PAGE HEADER */}
        <div className="ph">
          <div>
            <div className="ph-label">📋 Modul 03 — Data Trading</div>
            <h1 className="ph-title">Jurnal <em>Transaksi</em></h1>
            <p className="ph-sub">Catat setiap trade — semua kalkulasi otomatis.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono',monospace", fontSize: '8.5px', color: 'var(--text3)' }}>
              MATA UANG:
              <div className="selwrap">
                <select className="fselect" id="data-currency" value={currency} style={{ width: 'auto', padding: '5px 20px 5px 8px', fontSize: '10px' }}
                  onChange={e => { const cur = e.target.value as Currency; setCurrencyState(cur); localStorage.setItem('jz_currency', cur); }}>
                  <option value="IDR">🇮🇩 IDR</option>
                  <option value="CENT">📊 CENT</option>
                  <option value="USD">🇺🇸 USD</option>
                </select>
              </div>
            </div>
            {undoSnapshot && (
              <button className="btn btn-ghost btn-sm" id="undo-reset-btn" style={{ borderColor: 'var(--gold-bd)', color: 'var(--gold2)' }}
                onClick={() => { useTradeStore.setState({ trades: undoSnapshot }); useTradeStore.getState().persistLocal(); setUndoSnapshot(null); showToast('Data dikembalikan ✓', 'success'); }}>
                ↩ Undo Reset
              </button>
            )}
            <button className="btn btn-danger btn-sm" style={{ fontSize: '11px' }} onClick={handleResetTrades}>🗑️ Reset Data</button>
            <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--gold-bd)', color: 'var(--gold2)', fontSize: '11px' }} onClick={() => showToast('Fitur Share tersedia di versi production', 'success')}>✦ Share</button>
            <button className="btn btn-gold btn-sm" onClick={openAddModal}>+ Tambah Trade</button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="stat-row ai-anim d1">
          <div className="scard"><div className="scard-lbl">Total P&amp;L</div><div className={`scard-val ${stats.totalPL >= 0 ? 'green' : 'red'}`} id="s-pnl">{stats.total ? fmtMoney(stats.totalPL, currency) : '—'}</div></div>
          <div className="scard"><div className="scard-lbl">Win Rate</div><div className="scard-val" id="s-wr">{stats.total ? stats.wr + '%' : '—'}</div></div>
          <div className="scard"><div className="scard-lbl">Total Trade</div><div className="scard-val" id="s-total">{stats.total}</div></div>
          <div className="scard"><div className="scard-lbl">Saldo Akhir</div><div className="scard-val" id="s-saldo">{stats.total ? fmtMoney(stats.saldo, currency) : fmt(balCur)}</div></div>
        </div>

        {/* PROGRESS BAR */}
        <div className="ai-anim d2" id="data-prog-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--gold-bd)', borderRadius: '12px', padding: '16px 18px', marginBottom: '18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(212,175,55,0.04) 0%,transparent 60%)', pointerEvents: 'none', borderRadius: '12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>📈</span>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Progress ke Target Saldo</div>
                <div id="data-prog-sub" style={{ fontSize: '10px', marginTop: '2px', fontFamily: "'JetBrains Mono',monospace", color: subLabelColor }}>{subLabel}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div id="data-prog-pct" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontWeight: 700, color: 'var(--gold2)', lineHeight: 1 }}>{progToTarget.toFixed(1)}%</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: 'var(--text3)', marginTop: '1px' }}>dari target</div>
            </div>
          </div>
          <div style={{ height: '8px', background: 'var(--bg4)', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
            <div id="data-prog-fill" style={{ height: '100%', width: totalWidth + '%', background: barColor, borderRadius: '99px', transition: 'width 1.1s cubic-bezier(.34,1.56,.64,1)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '99px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: '9px' }}>
            <span style={{ color: 'var(--text3)' }}>Modal: <span id="data-prog-from" style={{ color: 'var(--text2)' }}>{balCur > 0 ? fmtDispCur(balCur, currency) : '—'}</span></span>
            <span style={{ color: 'var(--text3)' }}>Target: <span id="data-prog-to" style={{ color: 'var(--gold2)' }}>{tgtCur > 0 ? fmtDispCur(tgtCur, currency) : '—'}</span></span>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="box">
          <div className="box-head">
            <div className="box-title">📊 Data Trading</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div className="selwrap">
                <select className="fselect" id="f-pair-filter" value={pairFilter} style={{ width: 'auto', padding: '3px 18px 3px 7px', fontSize: '8.5px' }} onChange={e => setPairFilter(e.target.value)}>
                  <option value="">Semua Pair</option>
                  {pairOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="selwrap">
                <select className="fselect" id="f-result-filter" value={resultFilter} style={{ width: 'auto', padding: '3px 18px 3px 7px', fontSize: '8.5px' }} onChange={e => setResultFilter(e.target.value)}>
                  <option value="">Semua</option>
                  <option value="Profit">Profit</option>
                  <option value="Lose">Lose</option>
                </select>
              </div>
            </div>
          </div>
          <div className="tbl-scroll">
            <table className="dtable">
              <thead>
                <tr style={{ fontSize: '9px', height: '28px' }}>
                  <th>No</th><th>Tanggal</th><th>Bulan</th><th>Sesi</th><th>Pair</th><th>Posisi</th><th>Lot</th>
                  <th>Entry</th><th>SL</th><th>TP</th><th>Close</th><th>Result</th><th>Pips</th>
                  <th>RR</th><th>P/L</th><th>Total Profit</th><th>Total Saldo</th><th>Strategi</th><th>Catatan</th><th>Foto</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody id="data-tbody">
                {filteredTrades.length === 0 ? (
                  <tr><td colSpan={21}><div className="ph-empty"><div className="ph-icon">📭</div>Belum ada data. Klik <strong>+ Tambah Trade</strong>.</div></td></tr>
                ) : (
                  filteredTrades.map((t, i) => {
                    const isP = t.result === 'Profit';
                    const bulan = t.tanggal ? new Date(t.tanggal + 'T00:00:00').toLocaleString('id-ID', { month: 'long' }) : '—';
                    const runProfit = filteredTrades.slice(0, i + 1).reduce((s, x) => s + (x._pl || 0), 0);
                    const metodeStr = t.metode || t.strategi || '';
                    const rrColor = t.rr != null ? (t.rr >= 1 ? 'var(--green)' : t.rr >= 0.5 ? 'var(--gold2)' : 'var(--red)') : 'var(--text3)';
                    const rlBg = t.riskLevel === 'HIGH RISK' ? 'rgba(232,64,64,0.12)' : t.riskLevel === 'LOW RISK' ? 'var(--green-bg)' : 'rgba(201,168,76,0.12)';
                    const rlBd = t.riskLevel === 'HIGH RISK' ? 'var(--red-bd)' : t.riskLevel === 'LOW RISK' ? 'var(--green-bd)' : 'var(--gold-bd)';
                    const rlCl = t.riskLevel === 'HIGH RISK' ? 'var(--red)' : t.riskLevel === 'LOW RISK' ? 'var(--green)' : 'var(--gold)';
                    const emBg = t.emosiKontrol === 'Emosi' ? 'rgba(232,64,64,0.12)' : t.emosiKontrol === 'Aman' ? 'var(--green-bg)' : 'rgba(96,165,250,0.12)';
                    const emBd = t.emosiKontrol === 'Emosi' ? 'var(--red-bd)' : t.emosiKontrol === 'Aman' ? 'var(--green-bd)' : 'rgba(96,165,250,0.3)';
                    const emCl = t.emosiKontrol === 'Emosi' ? 'var(--red)' : t.emosiKontrol === 'Aman' ? 'var(--green)' : 'var(--blue)';
                    const photos = (t.photos || []).filter(Boolean);
                    return (
                      <tr key={t.id} style={{ fontSize: '9.5px', lineHeight: 1.3 }}>
                        <td className="no">{i + 1}</td>
                        <td className="str" style={{ fontSize: '10px' }}>{fmtDate(t.tanggal)}</td>
                        <td style={{ fontSize: '9px', color: 'var(--text3)' }}>{bulan}</td>
                        <td><span className="chip chip-blue">{t.sesi || '—'}</span></td>
                        <td className="str">{t.pair || '—'}</td>
                        <td><span className={`chip ${isP ? 'chip-buy' : 'chip-sell'}`}>{t.posisi || '—'}</span></td>
                        <td>{t.lot || '—'}</td>
                        <td>{t.entry || '—'}</td>
                        <td style={{ color: 'var(--red)', fontSize: '9.5px' }}>{t.sl || '—'}</td>
                        <td style={{ color: 'var(--green)', fontSize: '9.5px' }}>{t.tp || '—'}</td>
                        <td>{t.close || '—'}</td>
                        <td><span className={`chip ${isP ? 'chip-profit' : 'chip-lose'}`}>{t.result || '—'}</span></td>
                        <td>{t.pips != null ? Math.abs(t.pips).toFixed(2) : '—'}</td>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', fontWeight: 700, color: rrColor }}>
                          {t.rr != null ? '1:' + t.rr.toFixed(2) : '—'}
                        </td>
                        <td className={(t._pl || 0) >= 0 ? 'pos-val' : 'neg-val'}>{fmtPL(t._pl)}</td>
                        <td className={runProfit >= 0 ? 'pos-val' : 'neg-val'} style={{ fontSize: '9.5px' }}>{fmtPL(runProfit)}</td>
                        <td className="saldo-val" style={{ fontSize: '9.5px' }}>{fmtPL(t._saldo)}</td>
                        <td style={{ minWidth: '110px', verticalAlign: 'top', padding: '5px 7px' }}>
                          {metodeStr ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span className="chip chip-gold" style={{ fontSize: '7.5px', padding: '1px 5px', whiteSpace: 'nowrap' }}>{metodeStr}</span>
                              {t.reason && <div style={{ fontSize: '7px', color: 'var(--text3)' }}>{t.reason}</div>}
                              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                                {t.riskLevel && (
                                  <span className="chip" style={{ fontSize: '7px', padding: '1px 4px', background: rlBg, borderColor: rlBd, color: rlCl, whiteSpace: 'nowrap' }}>
                                    {t.riskLevel}
                                  </span>
                                )}
                                {t.emosiKontrol && (
                                  <span className="chip" style={{ fontSize: '7px', padding: '1px 4px', background: emBg, borderColor: emBd, color: emCl, whiteSpace: 'nowrap' }}>
                                    {t.emosiKontrol}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '9.5px', color: 'var(--text3)', whiteSpace: 'nowrap' }} title={t.catatan || ''}>
                          {t.catatan || '—'}
                        </td>
                        <td style={{ display: 'flex', gap: '2px', alignItems: 'center', padding: '4px 7px' }}>
                          {photos.length > 0
                            ? photos.map((p, pi) => (
                                <img key={pi} src={p} style={{ width: '20px', height: '20px', borderRadius: '3px', objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--gold-bd)' }}
                                  onClick={() => setLightboxSrc(p)} alt="" />
                              ))
                            : '—'}
                        </td>
                        <td style={{ padding: '4px 7px' }}>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 7px', fontSize: '10px' }} onClick={() => openEditModal(t)}>✏️</button>
                            <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px', fontSize: '10px' }} onClick={() => handleDeleteTrade(t.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM GRID */}
        <div className="data-bottom-grid">

          {/* DW */}
          <div className="box">
            <div className="box-head"><div className="box-title">💳 Deposit / Withdraw</div><button className="btn btn-ghost btn-sm" onClick={() => setDwModal(true)}>+ Tambah</button></div>
            <div className="stbl-scroll">
              <table className="stbl" id="dw-stbl">
                <thead><tr><th>Tanggal</th><th>Deposit</th><th>Withdraw</th><th></th></tr></thead>
                <tbody id="dw-tbody">
                  {/* Auto row: saldo awal dari profil risiko */}
                  {balanceIDR > 0 && (
                    <tr style={{ background: 'var(--gold-bg)' }}>
                      <td style={{ fontSize: '10px', color: 'var(--text3)' }}>{fmtDate(todayStr())}</td>
                      <td>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', fontWeight: 700, color: 'var(--gold2)' }}>
                          {fmt(idrToDisp(balanceIDR, currency))}
                        </span>
                        <span style={{ fontSize: '8px', color: 'var(--text3)', display: 'block' }}>Modal Awal (info)</span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '9px' }}>—</td>
                      <td style={{ fontSize: '8px', color: 'var(--text3)' }}>Auto</td>
                    </tr>
                  )}
                  {dwList.filter(d => !d._auto).length === 0 && !balanceIDR ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '14px', color: 'var(--text3)', fontSize: '11px' }}>Belum ada data</td></tr>
                  ) : (
                    dwList.filter(d => !d._auto).sort((a, b) => a.tanggal < b.tanggal ? -1 : 1).map(dw => {
                      const depIDR = dw.deposit || 0;
                      const wdIDR = dw.withdraw || 0;
                      const depDisp = idrToDisp(depIDR, currency);
                      const wdDisp = idrToDisp(wdIDR, currency);
                      return (
                        <tr key={dw.id}>
                          <td style={{ fontSize: '10px' }}>{fmtDate(dw.tanggal)}</td>
                          <td style={{ color: 'var(--green)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700 }}>
                            {depIDR ? '+' + fmt(depDisp) : '—'}
                          </td>
                          <td style={{ color: 'var(--red)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700 }}>
                            {wdIDR ? '-' + fmt(wdDisp) : '—'}
                          </td>
                          <td><button className="btn btn-danger btn-sm" style={{ fontSize: '9px', padding: '1px 5px' }} onClick={() => showConfirmModal('Hapus', 'Hapus entri ini?', 'Hapus', () => deleteDW(dw.id, userId))}>✕</button></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REKAP HARIAN */}
          <div className="box">
            <div className="box-head"><div className="box-title">📅 Rekap Harian</div></div>
            <div className="stbl-scroll">
              <table className="stbl">
                <thead><tr><th>Tanggal</th><th>Total P/L</th><th>Transaksi</th></tr></thead>
                <tbody id="rekap-tbody">
                  {rekapHarian.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '14px', color: 'var(--text3)', fontSize: '11px' }}>Belum ada data</td></tr>
                  ) : (
                    rekapHarian.map(r => (
                      <tr key={r.tgl}>
                        <td style={{ fontSize: '10px' }}>{fmtDate(r.tgl)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '10px', color: r.pl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoney(r.pl, currency)}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text3)' }}>{r.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* INFO AKUN */}
          <div className="box">
            <div className="box-head"><div className="box-title">⚙️ Info Akun</div></div>
            <div className="box-body-0">
              <table className="rtable">
                <tbody>
                  <tr><td className="lbl"><span>💰</span>Saldo Awal</td><td className="val" id="info-bal">{balCur > 0 ? fmtDispCur(balCur, currency) : '—'}</td></tr>
                  <tr><td className="lbl"><span>💱</span>Pair Fokus</td><td className="val" id="info-pair">{rs.pair || '—'}</td></tr>
                  <tr><td className="lbl"><span>🏦</span>Tipe Akun</td><td className="val" id="info-acc">{rs.tipeAkun || getTipeAkun(balCur, currency) || '—'}</td></tr>
                  <tr><td className="lbl"><span>📊</span>Mata Uang</td><td className="val" id="info-cur">{currency}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KESIMPULAN PERFORMA — 1:1 renderInfoAkun */}
          <div className="box">
            <div className="box-head"><div className="box-title">💡 Kesimpulan Performa</div></div>
            <div className="box-body-0">
              <table className="rtable">
                <tbody id="data-kesimpulan-tbody">
                  {stats.total === 0 ? (
                    <tr><td colSpan={2}><div className="ph-empty" style={{ padding: '12px' }}><div className="ph-icon">📊</div>Belum ada data</div></td></tr>
                  ) : (
                    <>
                      <tr><td className="lbl">✅ Total Win</td><td className="val green">{stats.wins} trade</td></tr>
                      <tr><td className="lbl">❌ Total Loss</td><td className="val red">{stats.losses} trade</td></tr>
                      <tr><td className="lbl">🎯 Win Rate</td><td className={`val ${stats.wr >= 50 ? 'green' : 'red'}`}>{stats.wr}%</td></tr>
                      <tr><td className="lbl">💰 Avg Profit/Trade</td><td className="val green">{fmtMoney(stats.avgWin, currency)}</td></tr>
                      <tr><td className="lbl">📉 Avg Loss/Trade</td><td className="val red">{fmtMoney(-stats.avgLoss, currency)}</td></tr>
                      <tr><td className="lbl">⚡ Profit Factor</td><td className={`val ${stats.profitFactor >= 1 ? 'green' : 'red'}`}>{stats.profitFactor ? stats.profitFactor.toFixed(2) : '—'}</td></tr>
                      <tr><td className="lbl">🔥 Win Streak</td><td className="val green">{stats.streak.win} beruntun</td></tr>
                      <tr><td className="lbl">💀 Loss Streak</td><td className="val red">{stats.streak.loss} beruntun</td></tr>
                      <tr><td className="lbl">📅 Hari Trading</td><td className="val">{stats.hariTrading} hari</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxSrc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px', border: '2px solid var(--gold-bd)', objectFit: 'contain' }} alt="preview" onClick={e => e.stopPropagation()} />
          <button style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }} onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}

      {tradeModal && <TradeModal form={form} setForm={setForm} onSave={handleSaveTrade} onClose={() => setTradeModal(false)} currency={currency} />}
      {dwModal && <DWModal currency={currency} onSave={handleSaveDW} onClose={() => setDwModal(false)} />}
    </>
  );
}