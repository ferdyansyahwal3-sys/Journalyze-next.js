// components/journal/PagePlan.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  liveRates,
  calcDailyGrowth,
  getLotByBal,
  calcMarginIDR,
  getTipeAkun,
  idrToDisp,
  fmtDispCur,
  type Currency,
} from '@/lib/riskCalc';

interface RiskState {
  balance: number;
  target: number;
  pair: string;
  currency: Currency;
  risk: number;
  months: number;
  leverage: number;
  tipeAkun: string;
}

interface PlanRow {
  day: number;
  balDisp: string;
  dtDisp: string;
  growthPct: string;
  lot: number;
  trd: number;
  pips: number;
  pFix: number;
  marginLotDisp: string;
  expDisp: string;
  milestone: boolean;
}

interface BatasanRow {
  l: string;
  v: string;
  n: string;
  c: string;
}

const DEFAULTS: RiskState = {
  balance: 0, target: 0, pair: 'XAUUSD',
  currency: 'IDR', risk: 1, months: 1, leverage: 500, tipeAkun: '—',
};

function getRiskState(): RiskState {
  try {
    const s = JSON.parse(localStorage.getItem('jz_state') || 'null');
    if (!s) return DEFAULTS;
    return { ...DEFAULTS, ...s };
  } catch { return DEFAULTS; }
}

export default function PagePlan({
  active,
  switchPage,
}: {
  active: boolean;
  switchPage: (page: string) => void;
}) {
  // ── FIX HYDRATION: mulai dengan DEFAULTS (sama di server & client),
  //    baru setelah mount baca localStorage ──
  const [rs, setRs] = useState<RiskState>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRs(getRiskState());
  }, []);

  // Re-read setiap kali tab diaktifkan
  useEffect(() => {
    if (active && mounted) setRs(getRiskState());
  }, [active, mounted]);

  const { balance, target, pair, currency, risk, months, leverage } = rs;
  const kurs = liveRates.USD_IDR || 16462;

  const toDisp = (idr: number) => idrToDisp(idr, currency);
  const fmtDisp = (v: number) => fmtDispCur(v, currency);
  const fmtMargin = (idrVal: number): string => {
    if (currency === 'CENT') return ((idrVal / kurs) * 100).toFixed(2) + '¢';
    if (currency === 'USD') return '$' + (idrVal / kurs).toFixed(2);
    return 'Rp ' + idrVal.toLocaleString('id-ID');
  };

  const curLabel = currency === 'CENT' ? '(¢)' : currency === 'USD' ? '($)' : '(Rp)';
  const hasData = balance > 0 && target > balance && months > 0;

  const dg = hasData ? calcDailyGrowth(balance, target, months) : 0;
  const dailyGrowthPct = dg * 100;
  const totalDays = months * 22;
  const tipeAkun = getTipeAkun(toDisp(balance), currency);
  const marginIDR = calcMarginIDR(pair, leverage, kurs);

  const PIPVAL_IDR = pair === 'XAUUSD'
    ? ((liveRates.XAU_USD || 2350) / 100) * kurs * 0.0001 * 100
    : kurs * 0.01;

  const balCur = toDisp(balance);
  const tgtCur = toDisp(target);
  const progPct = hasData ? Math.min(100, Math.max(0, (balCur / tgtCur) * 100)) : 0;

  const planRows = useMemo<PlanRow[]>(() => {
    if (!hasData) return [];
    const rows: PlanRow[] = [];
    let bal = balance;
    for (let day = 1; day <= totalDays; day++) {
      const dt = Math.round(bal * dg);
      const balDispVal = toDisp(bal);
      const lot = getLotByBal(currency === 'CENT' ? balDispVal : bal, currency);
      const dtDispRaw = toDisp(dt);

      let pips = lot > 0 ? Math.ceil(dtDispRaw / (lot * 10)) : 0;
      let pFix = Math.ceil(pips / 10) * 10;
      let trd = Math.max(1, Math.ceil(pFix / 40));
      let lotAdj = lot;

      if (currency === 'CENT' && trd > 8) {
        const lotMin = Math.ceil((dtDispRaw / (320 * 10)) * 100) / 100;
        lotAdj = Math.max(lot, Math.round(lotMin * 100) / 100);
        if (lotAdj > 0) {
          const pipsAdj = Math.ceil(dtDispRaw / (lotAdj * 10));
          pFix = Math.ceil(pipsAdj / 10) * 10;
          pips = pipsAdj;
        }
        trd = Math.max(1, Math.ceil(pFix / 40));
      }

      const expIDR = bal + dt;
      const marginLotIDR = leverage > 0 ? Math.round(marginIDR * (lotAdj / 0.01)) : 0;

      rows.push({
        day,
        balDisp: fmtDisp(toDisp(bal)),
        dtDisp: fmtDisp(toDisp(dt)),
        growthPct: dailyGrowthPct.toFixed(2) + '%',
        lot: lotAdj,
        trd,
        pips,
        pFix,
        marginLotDisp: marginLotIDR > 0 ? fmtMargin(marginLotIDR) : '—',
        expDisp: fmtDisp(toDisp(expIDR)),
        milestone: day % 5 === 0,
      });
      bal = expIDR;
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, target, months, currency, pair, leverage, kurs, mounted]);

  const batasanRows = useMemo<BatasanRow[]>(() => {
    if (!hasData) return [];
    const targetHarianIDR = Math.round(balance * dg);
    const maxLosePct = dailyGrowthPct * 1.5;
    const maxLoseIDR = Math.round((balance * maxLosePct) / 100);
    const riskPerTradeIDR = Math.round(balance * (risk / 100));
    const maxTrdPerHari = Math.min(8, Math.max(2, Math.ceil(maxLosePct / dailyGrowthPct)));
    return [
      { l: '🎯 Target Profit Harian', v: dailyGrowthPct.toFixed(2) + '%', n: fmtDisp(toDisp(targetHarianIDR)), c: 'green' },
      { l: '🛑 Maksimal Lose Harian', v: maxLosePct.toFixed(2) + '%', n: fmtDisp(toDisp(maxLoseIDR)), c: 'red' },
      { l: '⚠️ Risiko per Trade', v: ((riskPerTradeIDR / balance) * 100).toFixed(1) + '%', n: fmtDisp(toDisp(riskPerTradeIDR)), c: '' },
      { l: '🔢 Maks Trade per Hari', v: maxTrdPerHari + ' trade', n: 'Berhenti jika tercapai', c: '' },
      { l: '⏸️ Aturan Stop Trading', v: 'Jika max lose tercapai', n: 'Lanjut besok', c: 'red' },
      { l: '📏 Disiplin Lot', v: 'Jangan nambah lot saat rugi', n: 'Ikuti tabel Trading Plan', c: '' },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, target, months, risk, currency, kurs, mounted]);

  const pipValDisp = (() => {
    const r = Math.round(PIPVAL_IDR);
    if (currency === 'CENT') return ((PIPVAL_IDR / kurs) * 100).toFixed(2) + '¢ per 0.01 lot (~Rp ' + r.toLocaleString('id-ID') + ' IDR)';
    if (currency === 'USD') return '$' + (PIPVAL_IDR / kurs).toFixed(4) + ' per 0.01 lot (~Rp ' + r.toLocaleString('id-ID') + ' IDR)';
    return 'Rp ' + r.toLocaleString('id-ID') + ' per 0.01 lot';
  })();

  return (
    <div className={`page${active ? ' active' : ''}`} id="page-plan">

      <div className="ph ai-anim">
        <div>
          <div className="ph-label">📅 Modul 02 — Trading Plan Forex</div>
          <h1 className="ph-title">Proyeksi <em>Harian</em></h1>
          <p className="ph-sub">Tabel compound harian otomatis dari profil risiko kamu.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '5px', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)', color: 'var(--gold2)' }}>
            {pair || 'XAUUSD'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => switchPage('risk')}>← Edit Profil</button>
        </div>
      </div>

      <div className="g4 ai-anim d1" style={{ marginBottom: '16px' }}>
        <div className="ps-card"><div className="ps-val">{hasData ? fmtDisp(toDisp(balance)) : 'Rp 0'}</div><div className="ps-lbl">Modal Awal</div></div>
        <div className="ps-card"><div className="ps-val">{hasData ? fmtDisp(toDisp(target)) : 'Rp 0'}</div><div className="ps-lbl">Target Saldo</div></div>
        <div className="ps-card"><div className="ps-val">{hasData ? dailyGrowthPct.toFixed(2) + '%' : '0%'}</div><div className="ps-lbl">Growth / Hari</div></div>
        <div className="ps-card"><div className="ps-val">{hasData ? totalDays + ' Hari' : '0 Hari'}</div><div className="ps-lbl">Hari Trading</div></div>
      </div>

      <div className="ai-anim d2" style={{ background: 'var(--bg2)', border: '1px solid var(--gold-bd)', borderRadius: '12px', padding: '16px 18px', marginBottom: '18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(212,175,55,0.04) 0%,transparent 60%)', pointerEvents: 'none', borderRadius: '12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📈</span>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Progress ke Target Saldo</div>
              <div style={{ fontSize: '10px', marginTop: '2px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--text3)' }}>
                {hasData ? 'Saldo awal ' + fmtDisp(toDisp(balance)) : 'Hitung profil risiko terlebih dahulu'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontWeight: 700, color: 'var(--gold2)', lineHeight: 1 }}>{progPct.toFixed(1)}%</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: 'var(--text3)', marginTop: '1px' }}>dari target</div>
          </div>
        </div>
        <div style={{ height: '8px', background: 'var(--bg4)', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
          <div style={{ height: '100%', width: progPct + '%', background: 'linear-gradient(90deg,var(--gold),var(--gold3),#f0c040)', borderRadius: '99px', transition: 'width 1.1s cubic-bezier(.34,1.56,.64,1)', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '99px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: '9px' }}>
          <span style={{ color: 'var(--text3)' }}>Modal: <span style={{ color: 'var(--text2)' }}>{hasData ? fmtDisp(toDisp(balance)) : '—'}</span></span>
          <span style={{ color: 'var(--text3)' }}>Target: <span style={{ color: 'var(--gold2)' }}>{hasData ? fmtDisp(toDisp(target)) : '—'}</span></span>
        </div>
      </div>

      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8.5px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '11px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        Proyeksi Compounding Harian <span style={{ flex: 1, height: '1px', background: 'var(--gold-bd)', display: 'block' }} />
      </div>

      <div className="plan-scroll ai-anim d3">
        <table className="ptable">
          <thead>
            <tr>
              <th>DAY</th>
              <th>BALANCE {curLabel}</th>
              <th>TARGET PROFIT {curLabel}</th>
              <th>%</th><th>LOT</th><th>TRD</th><th>PIPS</th><th>PIPS FIX</th>
              <th style={{ color: 'var(--blue)' }}>MARGIN/TRADE</th>
              <th>EXPECTED SALDO {curLabel}</th>
            </tr>
          </thead>
          <tbody>
            {!hasData ? (
              <tr><td colSpan={10}><div className="ph-empty"><div className="ph-icon">📅</div>Kembali ke Risiko Trading dan klik Hitung.</div></td></tr>
            ) : (
              planRows.map((r) => (
                <tr key={r.day} className={r.milestone ? 'milestone' : ''}>
                  <td className="day">{r.day}</td>
                  <td className="bal">{r.balDisp}</td>
                  <td className="tgt">{r.dtDisp}</td>
                  <td>{r.growthPct}</td>
                  <td className="lot">{r.lot.toFixed(2)}</td>
                  <td>{r.trd}x</td>
                  <td>{r.pips.toLocaleString('id-ID')}</td>
                  <td>{r.pFix}</td>
                  <td style={{ color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', textAlign: 'right' }}>{r.marginLotDisp}</td>
                  <td className="exp">{r.expDisp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="g2 ai-anim d4" style={{ marginTop: '14px' }}>
        <div className="box">
          <div className="box-head"><div className="box-title">📎 Keterangan &amp; Data</div></div>
          <div className="box-body-0">
            <table className="rtable">
              <tbody>
                <tr><td className="lbl"><span>📈</span>Growth Harian</td><td className="val green">{hasData ? dailyGrowthPct.toFixed(2) + '%' : '—'}</td></tr>
                <tr><td className="lbl"><span>📅</span>Jumlah Hari Trading</td><td className="val">{hasData ? totalDays : '—'}</td></tr>
                <tr><td className="lbl"><span>💰</span>Value per Pip</td><td className="val blue">{hasData ? pipValDisp : '—'}</td></tr>
                <tr><td className="lbl"><span>⚡</span>Leverage Aktif</td><td className="val blue">{leverage > 0 ? '1:' + leverage : '—'}</td></tr>
                <tr><td className="lbl"><span>💳</span>Margin / 0.01 Lot</td><td className="val">{marginIDR > 0 ? fmtMargin(marginIDR) + ' / 0.01 lot' : '—'}</td></tr>
                <tr><td className="lbl"><span>🔁</span>Total Trade Estimasi</td><td className="val">{hasData ? (totalDays * 2) + ' trade (est.)' : '—'}</td></tr>
                <tr><td className="lbl"><span>🏦</span>Tipe Akun</td><td className="val">{hasData ? tipeAkun : '—'}</td></tr>
                <tr><td className="lbl"><span>💱</span>Mata Uang Jurnal</td><td className="val">{currency}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="box">
          <div className="box-head"><div className="box-title">⚠️ Catatan Penting</div></div>
          <div className="box-body">
            <div className="catatan-list">
              <div className="cat-item"><span>📌</span><span>Tabel ini adalah <strong>proyeksi ideal</strong>, bukan jaminan profit.</span></div>
              <div className="cat-item"><span>📌</span><span>Lot disesuaikan otomatis setiap hari (<strong>compounding</strong>).</span></div>
              <div className="cat-item"><span>📌</span><span>Jika loss, <strong>jangan tambah lot</strong> — ikuti rencana semula.</span></div>
              <div className="cat-item"><span>📌</span><span>Gunakan jurnal trading untuk evaluasi <strong>setiap hari</strong>.</span></div>
              <div className="cat-item"><span>📌</span><span>Template ini dianjurkan untuk <strong>penggunaan bulanan</strong>.</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="box ai-anim d4" style={{ marginTop: '4px' }}>
        <div className="box-head">
          <div className="box-title">🚦 Batasan Trading Harian</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: 'var(--text3)' }}>Risk Management Rules</div>
        </div>
        <div className="box-body-0">
          <table className="rtable">
            <tbody>
              {batasanRows.length === 0 ? (
                <tr><td colSpan={3}><div className="ph-empty"><div className="ph-icon">🚦</div>Hitung profil risiko terlebih dahulu</div></td></tr>
              ) : (
                batasanRows.map((r, i) => (
                  <tr key={i}>
                    <td className="lbl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{r.l}</td>
                    <td className={`val ${r.c}`} style={{ textAlign: 'right' }}>{r.v}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--text3)', textAlign: 'right' }}>{r.n}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}