'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
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
    hargaReal: 'Rp 249.000',
    nominal: 249000,
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

  const rawPaket = searchParams.get('paket') ?? 'pro';
  const initPaket: PaketKey = rawPaket in PAKET_DATA ? (rawPaket as PaketKey) : 'pro';

  const [selectedPaket, setSelectedPaket] = useState<PaketKey>(initPaket);
  const [nama, setNama] = useState('');
  const [waNum, setWaNum] = useState('');
  const emailFromUrl = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [promo, setPromo] = useState('');
  const [touched, setTouched] = useState({ nama: false, waNum: false, email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const paket = PAKET_DATA[selectedPaket];

  // Sync paket ke URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('paket', selectedPaket);
    window.history.replaceState({}, '', url.toString());
  }, [selectedPaket]);

  // Load Midtrans Snap script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://app.midtrans.com/snap/snap.js';
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
      const waFormatted = waNum.replace(/^0/, '62').replace(/\D/g, '');

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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memproses. Silakan coba lagi.');
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      window.snap.pay(data.token, {
        onSuccess: () => router.push('/journal?payment=success'),
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
        <a href="/home" className="order-nav-back">← Kembali</a>
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

        {/* ── PILIHAN PAKET (di atas form) ── */}
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
                    {p.hargaCoret}
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

                {/* Kode Promo */}
                <div className="order-field">
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
                  <div className="order-price-coret">{paket.hargaCoret}</div>
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
