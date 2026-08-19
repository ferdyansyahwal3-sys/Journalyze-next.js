// components/journal/PageRisk.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRates } from '@/hooks/useRates';
import { useRiskForm } from '@/hooks/useRiskForm';
import { liveRates } from '@/lib/riskCalc';
import type { Currency } from '@/lib/riskCalc';

export default function PageRisk({ active }: { active: boolean }) {
  // FIX: mounted flag — pastikan localStorage hanya diakses di client
  // Ini mencegah hydration mismatch yang bikin soft refresh kosong
  const [mounted, setMounted] = useState(false);

  const { ticker } = useRates();
  const {
    currency, setCurrency, balanceRaw, setBalanceRaw, targetRaw, setTargetRaw,
    risk, setRisk, months, setMonths, pair, leverage,
    pipval, pipvalHint, leverageHint, leverageWarn, convertInfo, balHint, tgtHint,
    result,
    onBalanceInput, onTargetInput, onPairChange, onLeverageChange, doCalc, resetRisk, calcFromValues,
    CURRENCY_PRE, CURRENCY_PH, CURRENCY_PHT,
  } = useRiskForm();

  useEffect(() => {
    setMounted(true);

    try {
      const savedCur = (localStorage.getItem('jz_currency') as Currency) || 'IDR';
      setCurrency(savedCur);

      const saved = JSON.parse(localStorage.getItem('jz_state') || 'null');
      if (!saved) return;

      const cur: Currency = saved.currency || saved.inputCurrency || savedCur;
      const kurs = liveRates?.USD_IDR || 16462;

      // Prioritas: balanceRaw (string display) → balanceInput (angka cur) → balance (IDR)
      let balStr = '';
      let tgtStr = '';

      if (saved.balanceRaw) {
        balStr = saved.balanceRaw;
      } else if (saved.balanceInput != null && !isNaN(saved.balanceInput)) {
        balStr = cur === 'IDR'
          ? Math.round(saved.balanceInput).toLocaleString('id-ID')
          : String(saved.balanceInput);
      } else if (saved.balance && !isNaN(saved.balance)) {
        balStr = cur === 'CENT'
          ? ((saved.balance / kurs) * 100).toFixed(1)
          : cur === 'USD'
          ? (saved.balance / kurs).toFixed(2)
          : Math.round(saved.balance).toLocaleString('id-ID');
      }

      if (saved.targetRaw) {
        tgtStr = saved.targetRaw;
      } else if (saved.targetInput != null && !isNaN(saved.targetInput)) {
        tgtStr = cur === 'IDR'
          ? Math.round(saved.targetInput).toLocaleString('id-ID')
          : String(saved.targetInput);
      } else if (saved.target && !isNaN(saved.target)) {
        tgtStr = cur === 'CENT'
          ? ((saved.target / kurs) * 100).toFixed(1)
          : cur === 'USD'
          ? (saved.target / kurs).toFixed(2)
          : Math.round(saved.target).toLocaleString('id-ID');
      }

      const riskNum = parseFloat(saved.risk);
      const monthsNum = parseInt(saved.months);
      const riskStr = isNaN(riskNum) ? '' : String(riskNum);
      const monthsStr = isNaN(monthsNum) ? '' : String(monthsNum);
      const pairStr = saved.pair || '';
      const levStr = saved.leverage ? String(saved.leverage) : '';

      if (balStr) setBalanceRaw(balStr);
      if (tgtStr) setTargetRaw(tgtStr);
      if (riskStr) setRisk(riskStr);
      if (monthsStr) setMonths(monthsStr);
      if (pairStr) onPairChange(pairStr, cur);
      if (levStr) onLeverageChange(levStr);

      if (balStr && tgtStr && levStr) {
        calcFromValues(balStr, tgtStr, cur, riskStr, monthsStr, pairStr, levStr);
      }

    } catch (e) {
      console.warn('[PageRisk] restore failed:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render ticker items sebagai string inline — sama persis dengan innerHTML asli
  // Ini fix tampilan kurs yang acak-acakan akibat React element wrap
  const tickerInner = ticker.items.length === 0
    ? null
    : ticker.items.map((item, i) => (
        <span key={item.p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          <span className="ticker-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="ticker-pair">{item.p}</span>
            <span className="ticker-rate">{item.r}</span>
          </span>
          {i < ticker.items.length - 1 && (
            <span style={{ color: 'var(--text4)', fontSize: 8, margin: '0 2px' }}>|</span>
          )}
        </span>
      ));

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-risk">

      {/* PAGE HEADER */}
      <div className="ph ai-anim">
        <div>
          <div className="ph-label">⚖️ Modul 01 — Manajemen Risiko</div>
          <h1 className="ph-title">Profil Risiko &amp; <em>Kalkulator</em></h1>
          <p className="ph-sub">Jawab 5 pertanyaan. Semua rekomendasi dihitung otomatis.</p>
        </div>
        <button className="btn btn-gold" onClick={doCalc}>⚡ Hitung Sekarang</button>
      </div>

      {/* LIVE KURS TICKER */}
      <div className="ticker ai-anim d1" id="ticker-wrap">
        <div className="ticker-dot"></div>
        <div className="ticker-label">Live Kurs</div>
        <div
          className="ticker-items"
          id="ticker-items"
          style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0, overflow: 'hidden' }}
        >
          {ticker.items.length === 0
            ? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', color: 'var(--text3)' }}>Memuat...</span>
            : tickerInner
          }
        </div>
        <div className="ticker-time" id="ticker-time">{mounted ? ticker.timeLabel : ''}</div>
      </div>

      {/* FORM + RESULTS */}
      <div className="g12">

        {/* ── FORM ── */}
        <div>
          <div className="box ai-anim d2">
            <div className="box-head">
              <div className="box-title">📝 Pertanyaan</div>
              <div className="box-title" style={{ color: 'var(--gold3)' }}>Jawab Disini!</div>
            </div>
            <div className="box-body">

              {/* 1. Currency chip */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">1. Pilih mata uang akun trading kamu</label>
                <div className="frow" style={{ gap: 6, marginTop: 2 }}>
                  {(['IDR', 'CENT', 'USD'] as Currency[]).map((c) => (
                    <div
                      key={c}
                      className={`chip-opt ${currency === c ? 'sel' : ''}`}
                      onClick={() => setCurrency(c)}
                      style={{ flex: 1, textAlign: 'center', padding: '7px 4px' }}
                    >
                      {c === 'IDR' ? '🇮🇩' : c === 'CENT' ? '📊' : '🇺🇸'} {c}
                      <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 1 }}>
                        {c === 'IDR' ? 'Rupiah' : c === 'CENT' ? 'Cent USD' : 'Dollar'}
                      </div>
                    </div>
                  ))}
                </div>
                {convertInfo && (
                  <div style={{ display: 'block', marginTop: 6, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--gold-bd)', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', color: 'var(--gold2)' }}>
                    {convertInfo}
                  </div>
                )}
              </div></div>

              {/* 2. Saldo awal */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">2. Saldo awal yang ingin kamu gunakan untuk trading?</label>
                <div className="fwrap">
                  <span className="fpre">{CURRENCY_PRE[currency]}</span>
                  <input
                    className="finput hp"
                    type="text"
                    id="q-balance"
                    value={balanceRaw}
                    onChange={(e) => onBalanceInput(e.target.value, currency)}
                    placeholder={CURRENCY_PH[currency]}
                  />
                </div>
                {balHint && <div className="fhint" style={{ color: 'var(--text3)' }}>{balHint}</div>}
              </div></div>

              {/* 3. Risiko */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">3. Risiko yang siap kamu tanggung di setiap transaksi?</label>
                <div className="selwrap">
                  <select className="fselect" value={risk} onChange={(e) => setRisk(e.target.value)}>
                    <option value="" disabled>— Pilih risiko per trade —</option>
                    <option value="1">1% — Konservatif</option>
                    <option value="2">2% — Moderat</option>
                    <option value="3">3% — Agresif</option>
                  </select>
                </div>
              </div></div>

              {/* 4. Durasi */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">4. Ingin mengembangkan akun ini dalam berapa bulan?</label>
                <div className="selwrap">
                  <select className="fselect" value={months} onChange={(e) => setMonths(e.target.value)}>
                    <option value="" disabled>— Pilih durasi —</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m} Bulan</option>
                    ))}
                  </select>
                </div>
              </div></div>

              {/* 5. Target */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">5. Target saldo yang kamu harapkan setelah periode tersebut?</label>
                <div className="fwrap">
                  <span className="fpre">{CURRENCY_PRE[currency]}</span>
                  <input
                    className="finput hp"
                    type="text"
                    id="q-target"
                    value={targetRaw}
                    onChange={(e) => onTargetInput(e.target.value, currency)}
                    placeholder={CURRENCY_PHT[currency]}
                  />
                </div>
                {tgtHint && <div className="fhint" style={{ color: 'var(--text3)' }}>{tgtHint}</div>}
              </div></div>

              {/* 6. Pair */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">6. Pair apa yang paling sering kamu gunakan atau fokuskan?</label>
                <div className="selwrap">
                  <select className="fselect" value={pair} onChange={(e) => onPairChange(e.target.value, currency)}>
                    <option value="" disabled>— Pilih pair utama —</option>
                    <option value="XAUUSD">XAUUSD — Gold</option>
                    <option value="USDJPY">USDJPY</option>
                    <option value="BTCUSD">BTCUSD — Bitcoin</option>
                    <option value="GBPUSD">GBPUSD</option>
                    <option value="NASDAQ">NAS100 — Nasdaq</option>
                  </select>
                </div>
              </div></div>

              <hr className="div" />

              {/* Pip value auto */}
              <div className="frow">
                <div className="fg">
                  <label className="flabel">Value per Pip (auto)</label>
                  <div className="fwrap">
                    <span className="fpre" id="q-pipval-pre">{CURRENCY_PRE[currency]}</span>
                    <input className="finput hp" type="text" id="q-pipval" value={pipval} readOnly />
                  </div>
                  {pipvalHint && <div className="fhint">{pipvalHint}</div>}
                </div>
                <select id="q-currency" value={currency} onChange={() => {}} style={{ display: 'none' }}>
                  <option value="IDR">IDR</option><option value="CENT">CENT</option><option value="USD">USD</option>
                </select>
              </div>

              <hr className="div" />

              {/* 7. Leverage */}
              <div className="frow f1"><div className="fg">
                <label className="flabel">7. Leverage akun kamu saat ini?</label>
                <div className="selwrap">
                  <select className="fselect" value={leverage} onChange={(e) => onLeverageChange(e.target.value)}>
                    <option value="" disabled>— Pilih leverage —</option>
                    <option value="100">1:100 — Konservatif</option>
                    <option value="200">1:200 — Standar</option>
                    <option value="500">1:500 — Umum</option>
                    <option value="1000">1:1000 — Tinggi ⚠️</option>
                    <option value="2000">1:2000 — Sangat Tinggi ⚠️</option>
                    <option value="3000">1:3000 — Ekstrem ⚠️</option>
                  </select>
                </div>
                <div className="fhint">{leverageHint}</div>
                {leverageWarn && (
                  <div style={{ display: 'block', marginTop: 7, padding: '8px 12px', background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.22)', borderRadius: 7, fontSize: 11, color: 'var(--red)', lineHeight: 1.6 }}>
                    ⚠️ <strong>Leverage sangat tinggi</strong> — Risiko margin call meningkat signifikan. Pastikan kamu memiliki manajemen risiko yang ketat.
                  </div>
                )}
              </div></div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-gold" onClick={doCalc} style={{ flex: 1 }}>⚡ Hitung &amp; Generate</button>
                <button className="btn btn-ghost" onClick={resetRisk}>↺ Reset</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULTS ── */}
        <div>
          <div className="box ai-anim d3">
            <div className="box-head">
              <div className="box-title">📊 Rangkuman Teknis</div>
              {result && (
                <span className={`rbadge ${result.badgeClass}`}>{result.badgeLabel}</span>
              )}
            </div>
            <div className="box-body-0">
              <table className="rtable" id="rtable">
                <tbody>
                  {!result
                    ? <tr><td colSpan={2}><div className="ph-empty"><div className="ph-icon">⚙️</div>Isi form dan klik Hitung Sekarang</div></td></tr>
                    : result.rows.map((r) => (
                      <tr key={r.l}>
                        <td className="lbl"><span>{r.i}</span>{r.l}</td>
                        <td className={`val ${r.c}`}>{r.v}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {result && (
            <div id="conc-section">
              <div className="box ai-anim d4">
                <div className="box-head"><div className="box-title">💡 Kesimpulan</div></div>
                <div className="box-body">
                  <div className="conc-box">
                    <div className="conc-label">✦ Analisis Otomatis</div>
                    <p className="conc-text" dangerouslySetInnerHTML={{ __html: result.concText }} />
                  </div>
                  <div className="acc-rec">
                    <div className="acc-rec-label">📌 Rekomendasi Tipe Akun</div>
                    <div className="acc-rec-val">{result.accRecVal}</div>
                    <div className="acc-rec-desc">{result.accRecDesc}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}