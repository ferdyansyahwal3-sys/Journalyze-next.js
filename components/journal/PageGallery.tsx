// components/journal/PageGallery.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTradeStore, recalcAll } from '@/store/useTradeStore';
import { useFotoAnalisa } from '@/hooks/usePhotoAnalysis';
import { useJournalStore } from '@/store/useJournalStore';
import { liveRates } from '@/lib/riskCalc';

type SortKey = 'newest' | 'oldest' | 'pl_asc' | 'pl_desc';

function getRiskState() {
  try {
    const s = JSON.parse(localStorage.getItem('jz_state') || 'null');
    return s || { balance: 0, currency: 'IDR' };
  } catch { return { balance: 0, currency: 'IDR' }; }
}

function fmtPL(val: number | null, result: string, currency: string): string {
  if (val == null) return 'belum ada';
  const abs = Math.abs(val).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const prefix = result === 'Profit' ? '+' : '';
  const sym = currency === 'IDR' ? 'Rp' : '$';
  return prefix + sym + abs;
}

function fmtTanggal(d: string): string {
  if (!d) return 'belum ada';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

export default function PageGallery({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('IDR');
  const [balanceIDR, setBalanceIDR] = useState(0);
  const [fPair, setFPair] = useState('');
  const [fResult, setFResult] = useState('');
  const [fSesi, setFSesi] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const { trades, dwList } = useTradeStore();
  const { openFotoFull } = useFotoAnalisa();
  const { openBreakdown } = useJournalStore();
  const kurs = liveRates.USD_IDR || 16462;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (active && mounted) {
      const rs = getRiskState();
      setCurrency(rs.currency || 'IDR');
      setBalanceIDR(rs.balance || 0);
    }
  }, [active, mounted]);

  const computedTrades = useMemo(() => {
    if (!mounted) return [];
    return recalcAll(trades, dwList, currency as 'IDR' | 'USD' | 'CENT', balanceIDR, kurs);
  }, [mounted, trades, dwList, currency, balanceIDR, kurs]);

  const pairOpts = useMemo(() =>
    [...new Set(computedTrades.map(t => t.pair).filter(Boolean))].sort(),
    [computedTrades]
  );

  const filtered = useMemo(() => {
    return computedTrades.filter(t => {
      if (fPair && t.pair !== fPair) return false;
      if (fResult && t.result !== fResult) return false;
      if (fSesi && t.sesi !== fSesi) return false;
      return true;
    });
  }, [computedTrades, fPair, fResult, fSesi]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'newest':  return arr.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      case 'oldest':  return arr.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      case 'pl_asc':  return arr.sort((a, b) => (a._pl ?? 0) - (b._pl ?? 0));
      case 'pl_desc': return arr.sort((a, b) => (b._pl ?? 0) - (a._pl ?? 0));
      default: return arr;
    }
  }, [filtered, sort]);

  const withFotoCount = sorted.filter(
    t => Array.isArray(t.fotoAnalisa) && t.fotoAnalisa.length > 0
  ).length;

  const resetFilter = () => { setFPair(''); setFResult(''); setFSesi(''); };

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'newest',  label: 'Terbaru' },
    { key: 'oldest',  label: 'Terlama' },
    { key: 'pl_asc',  label: 'P&L Naik' },
    { key: 'pl_desc', label: 'P&L Turun' },
  ];

  if (!mounted) return <div className={`page${active ? ' active' : ''}`} id="page-gallery" />;

  return (
    <div className={`page${active ? ' active' : ''}`} id="page-gallery">

      <div className="ph">
        <div>
          <div className="ph-label">📸 Modul 08 — Gallery Analisa</div>
          <h1 className="ph-title">Gallery <em>Foto Analisa</em></h1>
          <p className="ph-sub">Lihat semua foto analisa chart dari setiap trade kamu.</p>
        </div>
      </div>

      <div className="flt-bar" style={{ marginBottom: 12 }}>
        <div className="flt-dd-row">
          <div className="fg">
            <label className="flabel">Pair</label>
            <div className="selwrap">
              <select className="fselect" value={fPair} onChange={e => setFPair(e.target.value)}>
                <option value="">Semua Pair</option>
                {pairOpts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">Result</label>
            <div className="selwrap">
              <select className="fselect" value={fResult} onChange={e => setFResult(e.target.value)}>
                <option value="">Semua Result</option>
                <option value="Profit">Profit</option>
                <option value="Lose">Lose</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="flabel">Sesi</label>
            <div className="selwrap">
              <select className="fselect" value={fSesi} onChange={e => setFSesi(e.target.value)}>
                <option value="">Semua Sesi</option>
                <option>Asia</option>
                <option>London</option>
                <option>US</option>
              </select>
            </div>
          </div>
          <div className="fg" style={{ justifyContent: 'flex-end' }}>
            <label className="flabel">&nbsp;</label>
            <button className="btn btn-ghost btn-sm" onClick={resetFilter} style={{ alignSelf: 'flex-end' }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="gallery-sort-bar">
        {SORTS.map(s => (
          <button
            key={s.key}
            className={'gallery-sort-btn' + (sort === s.key ? ' active' : '')}
            onClick={() => setSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="gallery-count">
        {sorted.length} trade — {withFotoCount} punya foto analisa
      </div>

      {sorted.length === 0 ? (
        <div className="ph-empty">
          <div className="ph-icon">📸</div>
          {computedTrades.length === 0
            ? 'Belum ada data trade. Tambahkan trade dulu di halaman Jurnal.'
            : 'Tidak ada trade yang cocok dengan filter ini.'}
        </div>
      ) : (
        <div className="gallery-grid">
          {sorted.map(trade => {
            const plVal = trade._pl ?? null;
            const isProfit = trade.result === 'Profit';
            const plColor = isProfit ? 'var(--green)' : 'var(--red)';
            const hasFoto = Array.isArray(trade.fotoAnalisa) && trade.fotoAnalisa.length > 0;
            const foto = hasFoto ? trade.fotoAnalisa[0] : null;

            return (
              <div
                key={trade.id}
                className={'gallery-card gallery-card-clickable'}
                onClick={() => openBreakdown(trade, sorted)}
                role="button"
                tabIndex={0}
              >
                <div className="gallery-card-img-wrap">
                  {foto ? (
                    <>
                      <img
                        src={foto}
                        alt={trade.pair + ' ' + trade.posisi}
                        className="gallery-card-img"
                        loading="lazy"
                      />
                      <div className="gallery-card-overlay">
                        <div className="gallery-card-badges">
                          <span className="chip chip-gold">{trade.pair || 'belum ada'}</span>
                          <span className={'chip ' + (isProfit ? 'chip-buy' : 'chip-sell')}>
                            {trade.posisi || 'belum ada'}
                          </span>
                        </div>
                      </div>
                      {trade.fotoAnalisa.length > 1 && (
                        <div className="gallery-card-foto-count">
                          📸 {trade.fotoAnalisa.length}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="gallery-card-placeholder">
                      <div className="gallery-placeholder-icon">📷</div>
                      <div className="gallery-placeholder-text">Belum ada foto analisa</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span className="chip chip-gold">{trade.pair || 'belum ada'}</span>
                        <span className={'chip ' + (isProfit ? 'chip-buy' : 'chip-sell')}>
                          {trade.posisi || 'belum ada'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="gallery-card-info">
                  <div className="gallery-card-row1">
                    <span className={'chip ' + (isProfit ? 'chip-profit' : 'chip-lose')}>
                      {trade.result || 'belum ada'}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: plColor,
                    }}>
                      {fmtPL(plVal, trade.result, currency)}
                    </span>
                  </div>
                  <div className="gallery-card-row2">
                    <span>{fmtTanggal(trade.tanggal)}</span>
                    <span>·</span>
                    <span className="chip chip-blue" style={{ fontSize: 8 }}>
                      {trade.sesi || 'belum ada'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
