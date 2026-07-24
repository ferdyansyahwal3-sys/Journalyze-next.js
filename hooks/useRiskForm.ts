// hooks/useRiskForm.ts
// Dipindah dari index.html: doCalc() (baris 4302-4408), onPairChange(),
// onLeverageChange(), setCurrency(), updateConvertHint(), resetRisk().
// Semua update DOM diganti dengan setState — logic kalkulasinya identik.
'use client';

import { useState, useCallback } from 'react';
import { useJournalStore } from '@/store/useJournalStore';
import {
  liveRates,
  parseInputVal,
  inputToIDR,
  idrToDisp,
  fmtDispCur,
  getPipValue,
  getTipeAkun,
  getAccDesc,
  getLotByBal,
  getLayer,
  getSL,
  getProfil,
  getMindset,
  calcDailyGrowth,
  calcMarginIDR,
  getLeverageHint,
  type Currency,
} from '@/lib/riskCalc';

const CURRENCY_PRE: Record<Currency, string> = { IDR: 'Rp', CENT: 'c', USD: '$' };
const CURRENCY_PH: Record<Currency, string> = { IDR: 'Contoh: 3.000.000', CENT: 'Contoh: 20000', USD: 'Contoh: 200.00' };
const CURRENCY_PHT: Record<Currency, string> = { IDR: 'Contoh: 10.000.000', CENT: 'Contoh: 60000', USD: 'Contoh: 600.00' };

export interface RiskRow { i: string; l: string; v: string; c: string }
export interface RiskResult {
  rows: RiskRow[];
  badgeClass: string;
  badgeLabel: string;
  concText: string;
  accRecVal: string;
  accRecDesc: string;
}

export function useRiskForm() {
  const showToast = useJournalStore((s) => s.showToast);
  const showConfirmModal = useJournalStore((s) => s.showConfirmModal);

  const [currency, setCurrencyState] = useState<Currency>('IDR');
  const [balanceRaw, setBalanceRaw] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [risk, setRisk] = useState('');
  const [months, setMonths] = useState('');
  const [pair, setPair] = useState('');
  const [pipval, setPipval] = useState('163');
  const [leverage, setLeverage] = useState('');
  const [leverageHint, setLeverageHint] = useState('Leverage mempengaruhi margin yang dibutuhkan per trade dan profil risiko akun.');
  const [leverageWarn, setLeverageWarn] = useState(false);
  const [convertInfo, setConvertInfo] = useState('');
  const [balHint, setBalHint] = useState('');
  const [tgtHint, setTgtHint] = useState('');
  const [pipvalHint, setPipvalHint] = useState('');
  const [result, setResult] = useState<RiskResult | null>(null);

  // ── setCurrency (index.html baris 3871-3969) ──
  const setCurrency = useCallback((cur: Currency) => {
    setCurrencyState(cur);
    const kurs = liveRates.USD_IDR || 16462;
    if (cur === 'IDR') {
      setConvertInfo('');
    } else {
      const txt = cur === 'USD'
        ? 'Kurs: $1 = Rp ' + Math.round(kurs).toLocaleString('id-ID') + ' - nilai dikonversi ke IDR internal'
        : 'Kurs: 100c = $1 = Rp ' + Math.round(kurs).toLocaleString('id-ID') + ' - nilai dikonversi ke IDR internal';
      setConvertInfo(txt);
    }
    localStorage.setItem('jz_currency', cur);
    // NOTE: sync ke page-data (Phase 5) — dikerjakan saat useDataStore dibuat
  }, []);

  // ── updateConvertHint (index.html baris 3855-3869) ──
  const updateHints = useCallback((cur: Currency, balVal: string, tgtVal: string) => {
    const kurs = liveRates.USD_IDR || 16462;
    (['balance', 'target'] as const).forEach((key) => {
      const raw = key === 'balance' ? balVal : tgtVal;
      const val = parseInputVal(raw, cur);
      const idr = inputToIDR(val, cur);
      const hint = !val || cur === 'IDR' ? '' : '= Rp ' + Math.round(idr).toLocaleString('id-ID') + ' (kurs Rp ' + Math.round(kurs).toLocaleString('id-ID') + ')';
      if (key === 'balance') setBalHint(hint);
      else setTgtHint(hint);
    });
  }, []);

  const onBalanceInput = useCallback((val: string, cur: Currency) => {
    let v = val;
    if (cur === 'IDR') {
      const n = v.replace(/[^0-9]/g, '');
      v = n ? parseInt(n).toLocaleString('id-ID') : '';
    }
    setBalanceRaw(v);
    updateHints(cur, v, targetRaw);
  }, [targetRaw, updateHints]);

  // ── onPairChange (index.html baris 4258-4301) ──
  const onPairChange = useCallback((p: string, cur: Currency) => {
    setPair(p);
    if (!p) return;
    const kurs = liveRates.USD_IDR || 16300;
    const pv = getPipValue(p, cur);
    let pvDisp: string;
    if (cur === 'IDR') pvDisp = Math.round(pv * kurs / 100).toLocaleString('id-ID');
    else if (cur === 'CENT') pvDisp = (pv * 100 / 100).toFixed(2);
    else pvDisp = (pv / 100).toFixed(4);
    setPipval(pvDisp);
    const hints: Record<string, string> = {
      XAUUSD: 'Gold: pip value ' + CURRENCY_PRE[cur] + pvDisp + ' per 0.01 lot (Exness/HFM)',
      GBPUSD: 'GBP/USD: pip value sesuai broker',
      USDJPY: 'USD/JPY: pip value ~9.1x kurs',
      BTCUSD: 'BTC: pip value besar, hati-hati',
      NASDAQ: 'NAS100: pip value per point index',
    };
    setPipvalHint(hints[p] || 'Sesuaikan dengan broker');
  }, []);

  // ── onLeverageChange (index.html baris 4249-4257) ──
  const onLeverageChange = useCallback((lev: string) => {
    setLeverage(lev);
    const n = parseInt(lev) || 0;
    setLeverageWarn(n >= 1000);
    setLeverageHint(getLeverageHint(n));
  }, []);

  // ── doCalc (index.html baris 4302-4408) ──
  const doCalc = useCallback(() => {
    const kurs = liveRates.USD_IDR || 16462;
    const balanceInput = parseInputVal(balanceRaw, currency);
    const targetInput = parseInputVal(targetRaw, currency);
    const balance = inputToIDR(balanceInput, currency);
    const target = inputToIDR(targetInput, currency);
    const riskVal = parseFloat(risk);
    const monthsVal = parseInt(months);
    const leverageVal = parseInt(leverage) || 0;

    if (!balance || !target) { showToast('Isi saldo awal dan target!', 'error'); return; }
    if (target <= balance) { showToast('Target harus lebih besar dari saldo awal!', 'error'); return; }
    if (!leverageVal) { showToast('Pilih leverage akun kamu terlebih dahulu!', 'error'); return; }

    const toDisp = (v: number) => currency === 'CENT'
      ? Math.round((v / kurs) * 100 * 10) / 10
      : currency === 'USD' ? Math.round((v / kurs) * 100) / 100 : v;

    const balForLot = toDisp(balance);
    const tgtForLot = toDisp(target);
    const lotAwalPlan = getLotByBal(balForLot, currency);
    const lotAkhirPlan = getLotByBal(tgtForLot, currency);
    const fmt = (v: number) => Math.max(0.01, v).toFixed(2);
    let recLot = lotAwalPlan === lotAkhirPlan ? fmt(lotAwalPlan) : fmt(lotAwalPlan) + '—' + fmt(lotAkhirPlan);
    if (riskVal >= 3) recLot += ' ⚠️';

    const tipeAkun = getTipeAkun(balForLot, currency);
    const layer = getLayer(balForLot, currency);
    const sl = getSL(pair);
    const profil = getProfil(riskVal);
    const mindset = getMindset(riskVal);
    const growthBulanRp = target - balance;
    const growthBulanPct = ((target / balance) - 1) * 100;

    const layerMax = parseInt((layer.match(/(\d+)\s*Layer/g) || []).slice(-1)[0]) || 1;
    const perLotAwal = lotAwalPlan / layerMax;
    const perLotAkhir = lotAkhirPlan / layerMax;
    const fmtL = (v: number) => Math.max(0.01, Math.round(v * 100) / 100).toFixed(2);
    const perLayer = Math.abs(perLotAwal - perLotAkhir) < 0.005 ? fmtL(perLotAwal) : fmtL(perLotAwal) + '—' + fmtL(perLotAkhir);

    const marginIDR = calcMarginIDR(pair, leverageVal, kurs);
    const marginDisp = currency === 'IDR'
      ? 'Rp ' + marginIDR.toLocaleString('id-ID')
      : currency === 'CENT' ? ((marginIDR / kurs) * 100).toFixed(2) + '¢'
      : '$' + (marginIDR / kurs).toFixed(2);
    const freeMarginIDR = balance - marginIDR;
    const freeMarginDisp = currency === 'IDR'
      ? 'Rp ' + Math.abs(freeMarginIDR).toLocaleString('id-ID')
      : currency === 'CENT' ? ((Math.abs(freeMarginIDR) / kurs) * 100).toFixed(2) + '¢'
      : '$' + (Math.abs(freeMarginIDR) / kurs).toFixed(2);
    const isMarginOk = freeMarginIDR > 0;
    const leverageHighRisk = leverageVal >= 1000;

    const growthDisp = fmtDispCur(idrToDisp(growthBulanRp, currency), currency);
    const balDisp = fmtDispCur(idrToDisp(balance, currency), currency);
    const tgtDisp = fmtDispCur(idrToDisp(target, currency), currency);
    const leverageLabel = '1:' + leverageVal;

    const rows: RiskRow[] = [
      { i: '🏦', l: 'Tipe Akun Disarankan', v: tipeAkun, c: '' },
      { i: '📦', l: 'Rekomendasi Lot', v: recLot, c: 'blue' },
      { i: '⚖️', l: 'Rekomendasi Layer per 1x Entry', v: layer, c: '' },
      { i: '🔸', l: 'Rekomendasi Lot per Layer', v: perLayer, c: 'blue' },
      { i: '🎯', l: 'Stop Loss (SL) Direkomendasikan', v: sl, c: '' },
      { i: '📈', l: 'Growth Bulanan Ideal', v: growthDisp + ' (' + growthBulanPct.toFixed(1) + '%)', c: 'green' },
      { i: '🧠', l: 'Profil Risiko', v: profil.e + ' ' + profil.l, c: '' },
      { i: '💡', l: 'Saran Mindset', v: mindset, c: '' },
      { i: '⚡', l: 'Leverage Aktif', v: leverageLabel + (leverageHighRisk ? ' ⚠️' : ''), c: 'blue' },
      { i: '💳', l: 'Margin / 0.01 lot (' + pair + ')', v: marginDisp, c: '' },
      { i: '🛡️', l: 'Free Margin Estimasi', v: (isMarginOk ? '' : '⚠️ ') + freeMarginDisp, c: isMarginOk ? 'green' : 'red' },
    ];

    const leverageNote = leverageHighRisk
      ? ` Leverage <strong>${leverageLabel}</strong> sangat tinggi — <em>waspadai margin call di kondisi volatil</em>.`
      : ` Leverage <strong>${leverageLabel}</strong>, margin per trade <strong>${marginDisp}</strong>.`;

    const concText = `Dengan saldo awal <strong>${balDisp}</strong>, risiko <strong>${riskVal}%</strong>, target <strong>${tgtDisp}</strong> dalam <strong>${monthsVal} bulan</strong>, fokus pair <strong>${pair}</strong>. Akun: <strong>${tipeAkun}</strong>, lot ideal <strong>${recLot}</strong>, SL <strong>${sl}</strong>. Profil: <strong>${profil.l}</strong>.${leverageNote} Saran: <em>${mindset}</em> 🚀`;

    // Simpan state ke localStorage — sama seperti aslinya (baris 4390)
    const state = { balance, target, balanceInput, targetInput, inputCurrency: currency, risk: riskVal, months: monthsVal, pair, leverage: leverageVal, tipeAkun, currency };
    localStorage.setItem('jz_state', JSON.stringify(state));

    setResult({
      rows,
      badgeClass: leverageHighRisk ? 'ext' : profil.c,
      badgeLabel: (leverageHighRisk ? '⚠️ High Leverage — ' : profil.e + ' ') + profil.l,
      concText,
      accRecVal: tipeAkun,
      accRecDesc: getAccDesc(tipeAkun),
    });

    showToast('Kalkulasi selesai ✓', 'success');
  }, [balanceRaw, targetRaw, currency, risk, months, pair, leverage, showToast]);

  // ── resetRisk (index.html baris 4408-4430) ──
  const resetRisk = useCallback(() => {
    showConfirmModal(
      '⚙️ Reset Profil Risiko',
      'Semua pengaturan risiko & plan akan dikosongkan.<br><span style="color:var(--text3);font-size:11px">Data trading di halaman Jurnal tidak akan terhapus.</span>',
      'Reset Sekarang',
      () => {
        setBalanceRaw(''); setTargetRaw(''); setRisk(''); setMonths('');
        setPair(''); setPipval(''); setLeverage('');
        setPipvalHint(''); setLeverageHint('Leverage mempengaruhi margin yang dibutuhkan per trade dan profil risiko akun.');
        setLeverageWarn(false); setResult(null);
        setCurrency('IDR');
      }
    );
  }, [showConfirmModal]);

  // ── calcFromValues: hitung result langsung dari nilai tanpa lewat state ──
  // Dipakai oleh PageRisk untuk auto-calc saat restore dari localStorage
  const calcFromValues = useCallback((
    balRaw: string, tgtRaw: string, cur: Currency,
    riskStr: string, monthsStr: string, pairStr: string, levStr: string
  ) => {
    const kurs = liveRates.USD_IDR || 16462;
    const balanceInput = parseInputVal(balRaw, cur);
    const targetInput = parseInputVal(tgtRaw, cur);
    const balance = inputToIDR(balanceInput, cur);
    const target = inputToIDR(targetInput, cur);
    const riskVal = parseFloat(riskStr);
    const monthsVal = parseInt(monthsStr);
    const leverageVal = parseInt(levStr) || 0;
    if (!balance || !target || target <= balance || !leverageVal) return;

    const toDisp = (v: number) => cur === 'CENT'
      ? Math.round((v / kurs) * 100 * 10) / 10
      : cur === 'USD' ? Math.round((v / kurs) * 100) / 100 : v;

    const balForLot = toDisp(balance);
    const tgtForLot = toDisp(target);
    const lotAwalPlan = getLotByBal(balForLot, cur);
    const lotAkhirPlan = getLotByBal(tgtForLot, cur);
    const fmt = (v: number) => Math.max(0.01, v).toFixed(2);
    let recLot = lotAwalPlan === lotAkhirPlan ? fmt(lotAwalPlan) : fmt(lotAwalPlan) + '—' + fmt(lotAkhirPlan);
    if (riskVal >= 3) recLot += ' ⚠️';

    const tipeAkun = getTipeAkun(balForLot, cur);
    const layer = getLayer(balForLot, cur);
    const sl = getSL(pairStr);
    const profil = getProfil(riskVal);
    const mindset = getMindset(riskVal);
    const growthBulanRp = target - balance;
    const growthBulanPct = ((target / balance) - 1) * 100;

    const layerMax = parseInt((layer.match(/(\d+)\s*Layer/g) || []).slice(-1)[0]) || 1;
    const perLotAwal = lotAwalPlan / layerMax;
    const perLotAkhir = lotAkhirPlan / layerMax;
    const fmtL = (v: number) => Math.max(0.01, Math.round(v * 100) / 100).toFixed(2);
    const perLayer = Math.abs(perLotAwal - perLotAkhir) < 0.005 ? fmtL(perLotAwal) : fmtL(perLotAwal) + '—' + fmtL(perLotAkhir);

    const marginIDR = calcMarginIDR(pairStr, leverageVal, kurs);
    const marginDisp = cur === 'IDR'
      ? 'Rp ' + marginIDR.toLocaleString('id-ID')
      : cur === 'CENT' ? ((marginIDR / kurs) * 100).toFixed(2) + '¢'
      : '$' + (marginIDR / kurs).toFixed(2);
    const freeMarginIDR = balance - marginIDR;
    const freeMarginDisp = cur === 'IDR'
      ? 'Rp ' + Math.abs(freeMarginIDR).toLocaleString('id-ID')
      : cur === 'CENT' ? ((Math.abs(freeMarginIDR) / kurs) * 100).toFixed(2) + '¢'
      : '$' + (Math.abs(freeMarginIDR) / kurs).toFixed(2);
    const isMarginOk = freeMarginIDR > 0;
    const leverageHighRisk = leverageVal >= 1000;

    const growthDisp = fmtDispCur(idrToDisp(growthBulanRp, cur), cur);
    const balDisp = fmtDispCur(idrToDisp(balance, cur), cur);
    const tgtDisp = fmtDispCur(idrToDisp(target, cur), cur);
    const leverageLabel = '1:' + leverageVal;

    const rows: RiskRow[] = [
      { i: '🏦', l: 'Tipe Akun Disarankan', v: tipeAkun, c: '' },
      { i: '📦', l: 'Rekomendasi Lot', v: recLot, c: 'blue' },
      { i: '⚖️', l: 'Rekomendasi Layer per 1x Entry', v: layer, c: '' },
      { i: '🔸', l: 'Rekomendasi Lot per Layer', v: perLayer, c: 'blue' },
      { i: '🎯', l: 'Stop Loss (SL) Direkomendasikan', v: sl, c: '' },
      { i: '📈', l: 'Growth Bulanan Ideal', v: growthDisp + ' (' + growthBulanPct.toFixed(1) + '%)', c: 'green' },
      { i: '🧠', l: 'Profil Risiko', v: profil.e + ' ' + profil.l, c: '' },
      { i: '💡', l: 'Saran Mindset', v: mindset, c: '' },
      { i: '⚡', l: 'Leverage Aktif', v: leverageLabel + (leverageHighRisk ? ' ⚠️' : ''), c: 'blue' },
      { i: '💳', l: 'Margin / 0.01 lot (' + pairStr + ')', v: marginDisp, c: '' },
      { i: '🛡️', l: 'Free Margin Estimasi', v: (isMarginOk ? '' : '⚠️ ') + freeMarginDisp, c: isMarginOk ? 'green' : 'red' },
    ];

    const leverageNote = leverageHighRisk
      ? ` Leverage <strong>${leverageLabel}</strong> sangat tinggi — <em>waspadai margin call di kondisi volatil</em>.`
      : ` Leverage <strong>${leverageLabel}</strong>, margin per trade <strong>${marginDisp}</strong>.`;
    const concText = `Dengan saldo awal <strong>${balDisp}</strong>, risiko <strong>${riskVal}%</strong>, target <strong>${tgtDisp}</strong> dalam <strong>${monthsVal} bulan</strong>, fokus pair <strong>${pairStr}</strong>. Akun: <strong>${tipeAkun}</strong>, lot ideal <strong>${recLot}</strong>, SL <strong>${sl}</strong>. Profil: <strong>${profil.l}</strong>.${leverageNote} Saran: <em>${mindset}</em> 🚀`;

    setResult({
      rows,
      badgeClass: leverageHighRisk ? 'ext' : profil.c,
      badgeLabel: (leverageHighRisk ? '⚠️ High Leverage — ' : profil.e + ' ') + profil.l,
      concText,
      accRecVal: tipeAkun,
      accRecDesc: getAccDesc(tipeAkun),
    });
  }, []);

  // tambah onTargetInput
  const onTargetInput = useCallback((val: string, cur: Currency) => {
    let v = val;
    if (cur === 'IDR') {
      const n = v.replace(/[^0-9]/g, '');
      v = n ? parseInt(n).toLocaleString('id-ID') : '';
    }
    setTargetRaw(v);
    updateHints(cur, balanceRaw, v);
  }, [balanceRaw, updateHints]);

  return {
    currency, setCurrency, balanceRaw, setBalanceRaw, targetRaw, setTargetRaw,
    risk, setRisk, months, setMonths, pair, leverage,
    pipval, pipvalHint, leverageHint, leverageWarn, convertInfo, balHint, tgtHint,
    result,
    onBalanceInput, onTargetInput, onPairChange, onLeverageChange, doCalc, resetRisk,
    calcFromValues,
    CURRENCY_PRE, CURRENCY_PH, CURRENCY_PHT,
  };
}