'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { usePixel, setPixelContext } from '@/hooks/usePixel';
import { fireEvent, getAffiliateCode, saveAffiliateCode, getOrCreateSessionId } from '@/components/AffiliateTracker';
import './order.css';

/* ── PAKET DATA ── */
const PAKET_DATA = {
  basic: {
    label: 'Paket Basic',
    hargaCoret: 'Rp 149.000',
    hargaReal: 'Rp 99.000',
    nominal: 99000,
    durasi: 'Akses 3 bulan · Web App Only',
    fitur: [
      'Akses Journalyze Web App',
      'Kalkulator risiko & lot size',
      'Rekap & analisis trade',
      'Trading plan harian',
      'Share journal publik',
    ],
    badge: null,
  },
  pro: {
    label: 'Paket Pro',
    hargaCoret: 'Rp 297.000',
    hargaReal: 'Rp 149.000',
    nominal: 149000,
    durasi: 'Lifetime · + E-Book + Komunitas',
    fitur: [
      'Semua fitur Journalyze Web App',
      'Akses LIFETIME (bukan langganan)',
      '2 E-Book Trading Premium (Bonus)',
      'Akses grup komunitas trader',
      'Konsultasi 1x via WhatsApp',
      'Semua update fitur gratis',
    ],
    badge: '⭐ Paling Populer',
  },
  elite: {
    label: 'Paket Elite',
    hargaCoret: 'Rp 497.000',
    hargaReal: 'Rp 299.000',
    nominal: 299000,
    durasi: 'Lifetime · + Review + Konsultasi 3x',
    fitur: [
      'Semua fitur Paket Pro',
      'Review journal bulanan (1x/bulan)',
      'Konsultasi trading 3x via WhatsApp',
      'Analisis psikologi trading',
      'Feedback strategy personal',
      'Prioritas support & update',
    ],
    badge: '🔥 Terlengkap',
  },
} as const;

/* ── PAKET DATA AFFILIATE (harga coret disesuaikan) ── */
const PAKET_DATA_AFFILIATE = {
  basic: {
    ...({} as typeof PAKET_DATA.basic),
    hargaCoret: 'Rp 149.000',
    hargaSave:  'Hemat Rp 50.000',
  },
  pro: {
    ...({} as typeof PAKET_DATA.pro),
    hargaCoret: 'Rp 248.000',
    hargaSave:  'Hemat Rp 99.000',
  },
  elite: {
    ...({} as typeof PAKET_DATA.elite),
    hargaCoret: 'Rp 497.000',
    hargaSave:  'Hemat Rp 198.000',
  },
} as const;

type PaketKey = keyof typeof PAKET_DATA;

const WA_ADMIN = '6281311973602';

function validateWA(val: string) {
  const stripped = val.replace(/\D/g, '');
  return stripped.length >= 9 && stripped.length <= 15;
}
function validateEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}
function validatePassword(val: string) {
  return val.length >= 8;
}



declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess: (result: unknown) => void;
        onPending: (result: unknown) => void;
        onError: (result: unknown) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

function OrderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fireTrigger } = usePixel();

  const rawPaket = searchParams.get('paket') ?? 'pro';
  const initPaket: PaketKey = rawPaket in PAKET_DATA ? (rawPaket as PaketKey) : 'pro';

  const [selectedPaket, setSelectedPaket] = useState<PaketKey>(initPaket);
  const [nama, setNama] = useState('');
  const [waNum, setWaNum] = useState('');
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [promo, setPromo] = useState('');
  const [touched, setTouched] = useState({ nama: false, waNum: false, email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Affiliate state ──
  const [affiliateInput, setAffiliateInput] = useState('');
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null); // kode final tervalidasi
  const [affiliateStatus, setAffiliateStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [affiliateName, setAffiliateName] = useState('');
  const affiliateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paket = PAKET_DATA[selectedPaket];
  const paketAffiliate = affiliateCode ? PAKET_DATA_AFFILIATE[selectedPaket] : null;
  const hargaCoretDisplay = paketAffiliate?.hargaCoret ?? paket.hargaCoret;
  const hargaSaveDisplay  = paketAffiliate?.hargaSave ?? null;

  // ── Baca ?ref= dari URL saat mount, simpan ke localStorage ──
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam && refParam.trim()) {
      const code = refParam.trim().toLowerCase();
      saveAffiliateCode(code);
      setAffiliateCode(code);
      // Validasi ke API
      validateAffiliateCode(code, true);
    } else {
      // Tidak ada ref di URL → cek localStorage
      const lsCode = getAffiliateCode();
      if (lsCode) {
        setAffiliateCode(lsCode);
        validateAffiliateCode(lsCode, true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validasi kode affiliate ke API ──
  async function validateAffiliateCode(code: string, silent = false) {
    if (!code.trim()) {
      setAffiliateStatus('idle');
      setAffiliateCode(null);
      return;
    }
    if (!silent) setAffiliateStatus('checking');
    try {
      const res = await fetch(`/api/affiliate/validate?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json() as { valid: boolean; name?: string };
      if (data.valid) {
        setAffiliateStatus('valid');
        setAffiliateName(data.name || '');
        const finalCode = code.trim().toLowerCase();
        setAffiliateCode(finalCode);
        saveAffiliateCode(finalCode);
        if (silent) setAffiliateInput(code.trim().toUpperCase());
      } else {
        setAffiliateStatus('invalid');
        // Jangan hapus affiliateCode dari localStorage jika dari URL/LS dan ternyata invalid
        // — kode input manual yang invalid tidak mengubah kode yang sudah tersimpan
        if (!silent) setAffiliateCode(null);
      }
    } catch {
      setAffiliateStatus('idle');
    }
  }

  // ── Debounce input kode manual ──
  function handleAffiliateInputChange(val: string) {
    const upper = val.toUpperCase();
    setAffiliateInput(upper);
    setAffiliateStatus('idle');

    if (affiliateDebounceRef.current) clearTimeout(affiliateDebounceRef.current);
    if (!upper.trim()) {
      setAffiliateStatus('idle');
      // Kembalikan ke kode dari localStorage jika ada
      const lsCode = getAffiliateCode();
      setAffiliateCode(lsCode);
      return;
    }
    affiliateDebounceRef.current = setTimeout(() => {
      validateAffiliateCode(upper, false);
    }, 600);
  }

  // Meta Pixel: konteks harga paket untuk aturan event (nilai otomatis)
  useEffect(() => {
    setPixelContext({ value: PAKET_DATA[selectedPaket].nominal, content_name: 'Journalyze Premium' });
  }, [selectedPaket]);

  // Sync paket ke URL + fire plan_select event
  const isFirstRender = useRef(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('paket', selectedPaket);
    window.history.replaceState({}, '', url.toString());
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const code = getAffiliateCode();
    if (code) fireEvent(code, 'plan_select', 'order', { plan_type: selectedPaket });
  }, [selectedPaket]);

  // Load Midtrans Snap script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = process.env.NEXT_PUBLIC_MIDTRANS_SANDBOX === 'true' ? 'https://app.sandbox.midtrans.com/snap/snap.js' : 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
    script.onload = () => setSnapLoaded(true);
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  const errors = {
    nama: touched.nama && nama.trim().length < 3 ? 'Nama minimal 3 karakter' : '',
    waNum: touched.waNum && !validateWA(waNum) ? 'Nomor WhatsApp tidak valid' : '',
    email: touched.email && !validateEmail(email) ? 'Format email tidak valid' : '',
    password: touched.password && !validatePassword(password) ? 'Password minimal 8 karakter' : '',
  };

  const isFormValid =
    nama.trim().length >= 3 &&
    validateWA(waNum) &&
    validateEmail(email) &&
    validatePassword(password);

  const handleSubmit = async () => {
    setTouched({ nama: true, waNum: true, email: true, password: true });
    if (!isFormValid) return;
    if (!snapLoaded) {
      setErrorMsg('Payment gateway belum siap, coba lagi dalam beberapa detik.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      fireTrigger('pay_click', { value: paket.nominal, content_name: paket.label });


      const waFormatted = waNum.replace(/^0/, '62').replace(/\D/g, '');

      // Ambil affiliate code final (dari state, sudah tervalidasi)
      const finalAffiliateCode = affiliateCode || null;

      // Fire checkout_start event
      if (finalAffiliateCode) {
        fireEvent(finalAffiliateCode, 'checkout_start', 'order', { plan_type: selectedPaket });
      }

      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: nama.trim(),
          phone: `+${waFormatted}`,
          email: email.trim(),
          password,
          promo_code: promo.trim() || null,
          paket: selectedPaket,
          nominal: paket.nominal,
          paket_label: paket.label,
          affiliate_code: finalAffiliateCode,
        }),
      });

      const data = await res.json() as {
        token?: string;
        redirect_url?: string;
        order_id?: string;
        final_amount?: number;
        error?: string;
      };

      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memproses. Silakan coba lagi.');
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      window.snap.pay(data.token!, {
        onSuccess: async () => {
          await fireTrigger('payment_success', {
            value: Number(data.final_amount) || paket.nominal,
            content_name: paket.label,
            eventId: data.order_id,
          });
          // Hapus affiliate dari localStorage setelah sukses bayar
          try { localStorage.removeItem('jz_affiliate_ref'); } catch { /* noop */ }
          router.push(`/journal?payment=success&order_id=${encodeURIComponent(String(data.order_id ?? ''))}`);
        },
        onPending: () => router.push('/journal?payment=pending'),
        onError: () => setErrorMsg('Pembayaran gagal. Silakan coba lagi.'),
        onClose: () => {},
      });

    } catch {
      setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
      setSubmitting(false);
    }
  };

  return (
    <div className="order-root">
      <nav className="order-nav">
        <a href="/home" className="order-nav-logo">
          Journal<em>yze</em>
          <span className="order-nav-badge">v2.0</span>
        </a>
        <a href={affiliateCode ? `/?ref=${affiliateCode}` : '/home'} className="order-nav-back">← Kembali</a>
      </nav>

      <main className="order-main">
        <div className="order-header">
          <div className="order-header-tag">
            <span className="dot" />
            <span>Checkout Aman · Aktivasi Otomatis</span>
          </div>
          <h1 className="order-headline">
            Dapatkan Akses <em>Journalyze</em>
          </h1>
          <p className="order-headline-sub">
            Daftar & bayar sekarang — akun langsung aktif otomatis tanpa konfirmasi manual.
          </p>
        </div>

        {/* ── PILIHAN PAKET ── */}
        <div style={{ maxWidth: 900, margin: '0 auto 32px', padding: '0 16px' }}>
          <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Pilih Paket
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(Object.keys(PAKET_DATA) as PaketKey[]).map((key) => {
              const p = PAKET_DATA[key];
              const isSelected = selectedPaket === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedPaket(key)}
                  style={{
                    background: isSelected ? 'rgba(201,168,76,0.1)' : '#111',
                    border: isSelected ? '1.5px solid #C9A84C' : '1.5px solid #222',
                    borderRadius: 12,
                    padding: '16px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {p.badge && (
                    <div style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#C9A84C',
                      color: '#000',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                    }}>
                      {p.badge}
                    </div>
                  )}
                  <div style={{ color: isSelected ? '#C9A84C' : '#aaa', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {p.label}
                  </div>
                  <div style={{ color: '#555', fontSize: 11, textDecoration: 'line-through', marginBottom: 2 }}>
                    {affiliateCode && PAKET_DATA_AFFILIATE[key as PaketKey]?.hargaCoret
                        ? PAKET_DATA_AFFILIATE[key as PaketKey].hargaCoret
                        : p.hargaCoret}
                  </div>
                  <div style={{ color: isSelected ? '#fff' : '#ccc', fontSize: 18, fontWeight: 700 }}>
                    {p.hargaReal}
                  </div>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                    {p.durasi}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="order-layout">
          {/* ═══ LEFT: FORM ═══ */}
          <div className="order-form-col">
            <div className="order-card">
              <div className="order-card-head">
                <span className="order-card-title">📋 Buat Akun & Bayar</span>
              </div>
              <div className="order-card-body">

                {errorMsg && (
                  <div style={{
                    background: '#2a0a0a',
                    border: '1px solid #c0392b',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: '#e74c3c',
                    fontSize: 13,
                    marginBottom: 16,
                  }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Nama */}
                <div className={`order-field${errors.nama ? ' has-error' : ''}`}>
                  <label className="order-label">Nama Lengkap <span className="req">*</span></label>
                  <input
                    type="text"
                    className="order-input"
                    placeholder="contoh: Budi Santoso"
                    value={nama}
                    onChange={e => setNama(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, nama: true }))}
                    autoComplete="name"
                  />
                  {errors.nama && <div className="order-error">{errors.nama}</div>}
                </div>

                {/* WhatsApp */}
                <div className={`order-field${errors.waNum ? ' has-error' : ''}`}>
                  <label className="order-label">Nomor WhatsApp <span className="req">*</span></label>
                  <div className="order-input-wrap">
                    <span className="order-input-prefix">+62</span>
                    <input
                      type="tel"
                      className="order-input has-prefix"
                      placeholder="8xx-xxxx-xxxx"
                      value={waNum}
                      onChange={e => setWaNum(e.target.value)}
                      onBlur={() => setTouched(t => ({ ...t, waNum: true }))}
                      autoComplete="tel"
                    />
                  </div>
                  {errors.waNum && <div className="order-error">{errors.waNum}</div>}
                  <div className="order-hint">Untuk follow up & info aktivasi</div>
                </div>

                {/* Email */}
                <div className={`order-field${errors.email ? ' has-error' : ''}`}>
                  <label className="order-label">Alamat Email <span className="req">*</span></label>
                  <input
                    type="email"
                    className="order-input"
                    placeholder="email@kamu.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                    autoComplete="email"
                  />
                  {errors.email && <div className="order-error">{errors.email}</div>}
                </div>

                {/* Password */}
                <div className={`order-field${errors.password ? ' has-error' : ''}`}>
                  <label className="order-label">Password <span className="req">*</span></label>
                  <input
                    type="password"
                    className="order-input"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    autoComplete="new-password"
                  />
                  {errors.password && <div className="order-error">{errors.password}</div>}
                  <div className="order-hint">Password untuk login ke Journalyze</div>
                </div>

                {/* Kode Promo — sembunyikan jika dari affiliate */}
                <div className="order-field" style={{ display: affiliateCode ? 'none' : 'block' }}>
                  <label className="order-label">Kode Promo <span className="optional">(opsional)</span></label>
                  <input
                    type="text"
                    className="order-input"
                    placeholder="Masukkan kode promo jika ada"
                    value={promo}
                    onChange={e => setPromo(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                </div>

                {/* ── Kode Referral (Affiliate) ── */}
                <div className="order-field">
                  <label className="order-label">
                    Kode Referral <span className="optional">(opsional)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="order-input"
                      placeholder="Contoh: ILHAM10"
                      value={affiliateInput}
                      onChange={e => handleAffiliateInputChange(e.target.value)}
                      autoComplete="off"
                      maxLength={12}
                      style={{
                        borderColor:
                          affiliateStatus === 'valid' ? 'var(--gold, #C9A84C)' :
                          affiliateStatus === 'invalid' ? '#c0392b' :
                          undefined,
                      }}
                    />
                    {affiliateStatus === 'checking' && (
                      <span style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 12,
                        color: '#666',
                      }}>
                        ⏳
                      </span>
                    )}
                  </div>

                  {/* Status chip */}
                  {affiliateStatus === 'valid' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(201,168,76,0.12)',
                        border: '1px solid rgba(201,168,76,0.4)',
                        borderRadius: 20,
                        padding: '3px 10px',
                        fontSize: 12,
                        color: 'var(--gold, #C9A84C)',
                        fontWeight: 600,
                      }}>
                        ✓ Kode referral dikenali{affiliateName ? ` — ${affiliateName}` : ''}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#22c55e', fontWeight: 600,
                      }}>
                        🎁 {hargaSaveDisplay ?? 'Hemat'} dengan kode ini!
                      </div>
                    </div>
                  )}
                  {affiliateStatus === 'invalid' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#e74c3c' }}>
                      Kode tidak ditemukan
                    </div>
                  )}

                  {/* Chip jika kode dari URL/LS (silent valid) */}
                  {affiliateStatus === 'idle' && affiliateCode && !affiliateInput && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      background: 'rgba(201,168,76,0.08)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      borderRadius: 20,
                      padding: '3px 10px',
                      fontSize: 12,
                      color: 'var(--gold, #C9A84C)',
                    }}>
                      ✓ Referral aktif: {affiliateCode.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  className={`order-submit-btn${submitting ? ' loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><span className="order-spinner" /><span>Memproses...</span></>
                  ) : (
                    <><span>💳</span><span>Daftar & Bayar {paket.hargaReal}</span></>
                  )}
                </button>

                <div className="order-secure-note">
                  <span>🔒</span>
                  <span>Pembayaran aman via Midtrans · Akun aktif otomatis setelah bayar</span>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#666' }}>
                  Sudah punya akun?{' '}
                  <a href="/journal" style={{ color: '#C9A84C', textDecoration: 'none' }}>Login di sini</a>
                </div>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#666' }}>
                  Punya kode lisensi dari Lynk.id/Scalev?{' '}
                  <a href="/delivery" style={{ color: '#C9A84C', textDecoration: 'none' }}>Aktivasi di sini</a>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: RINGKASAN ═══ */}
          <div className="order-summary-col">
            <div className={`order-summary-card${selectedPaket === 'pro' ? ' highlight' : ''}`}>
              {paket.badge && <div className="order-summary-badge">{paket.badge}</div>}
              <div className="order-summary-head">
                <span className="order-card-title">{paket.label}</span>
              </div>
              <div className="order-summary-body">
                <div className="order-price-block">
                  <div className="order-price-coret">{hargaCoretDisplay}</div>
                  <div className="order-price-real">{paket.hargaReal}</div>
                  <div className="order-price-durasi">{paket.durasi}</div>
                </div>
                <div className="order-summary-divider" />
                <div className="order-fitur-list">
                  {paket.fitur.map(f => (
                    <div key={f} className="order-fitur-item">
                      <span className="order-fitur-check">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-trust-box">
              <div className="order-trust-title">Mengapa Aman Pesan di Sini?</div>
              {[
                { icon: '⚡', text: 'Aktivasi otomatis setelah pembayaran sukses' },
                { icon: '💬', text: 'Follow up langsung via WhatsApp' },
                { icon: '♾️', text: 'Lifetime — bayar sekali, pakai selamanya' },
                { icon: '🔒', text: 'Data trading tersimpan aman di cloud' },
              ].map(t => (
                <div key={t.text} className="order-trust-item">
                  <span className="order-trust-icon">{t.icon}</span>
                  <span>{t.text}</span>
                </div>
              ))}
            </div>

            <div className="order-tanya-box">
              <div className="order-tanya-text">Masih ada pertanyaan?</div>
              <a
                href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent('Halo, saya ingin info lebih lanjut tentang Journalyze 🙏')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="order-tanya-btn"
              >
                <span>💬</span><span>Chat Admin WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="order-footer">
        <span>© 2025 Journalyze. All rights reserved.</span>
        <div className="order-footer-links">
          <a href="#">Kebijakan Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
        <div style={{ color: '#C9A84C', fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
          Memuat halaman...
        </div>
      </div>
    }>
      <OrderForm />
    </Suspense>
  );
}