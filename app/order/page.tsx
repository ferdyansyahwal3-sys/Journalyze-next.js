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
    waMsg: (nama: string, wa: string, email: string, promo: string) =>
      `Halo, saya ingin order *Paket Basic Journalyze (Rp 99.000)*%0A%0A*Nama:* ${encodeURIComponent(nama)}%0A*WhatsApp:* ${encodeURIComponent(wa)}%0A*Email:* ${encodeURIComponent(email)}${promo ? `%0A*Kode Promo:* ${encodeURIComponent(promo)}` : ''}%0A%0ASilakan konfirmasi ketersediaan dan info pembayaran 🙏`,
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
    waMsg: (nama: string, wa: string, email: string, promo: string) =>
      `Halo, saya mau order *Paket Pro Journalyze (Rp 149.000)* ⭐%0A%0A*Nama:* ${encodeURIComponent(nama)}%0A*WhatsApp:* ${encodeURIComponent(wa)}%0A*Email:* ${encodeURIComponent(email)}${promo ? `%0A*Kode Promo:* ${encodeURIComponent(promo)}` : ''}%0A%0AMohon info rekening & langkah selanjutnya 🙏`,
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
    waMsg: (nama: string, wa: string, email: string, promo: string) =>
      `Halo, saya mau order *Paket Elite Journalyze (Rp 249.000)* 🔥%0A%0A*Nama:* ${encodeURIComponent(nama)}%0A*WhatsApp:* ${encodeURIComponent(wa)}%0A*Email:* ${encodeURIComponent(email)}${promo ? `%0A*Kode Promo:* ${encodeURIComponent(promo)}` : ''}%0A%0AMohon info rekening & langkah selanjutnya 🙏`,
  },
} as const;

type PaketKey = keyof typeof PAKET_DATA;

const WA_ADMIN = '6281311973602';

/* ── VALIDASI ── */
function validateWA(val: string) {
  const stripped = val.replace(/\D/g, '');
  return stripped.length >= 9 && stripped.length <= 15;
}
function validateEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/* ── INNER COMPONENT (reads searchParams) ── */
function OrderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawPaket = searchParams.get('paket') ?? 'pro';
  const paketKey: PaketKey = rawPaket in PAKET_DATA ? (rawPaket as PaketKey) : 'pro';

  const [selectedPaket, setSelectedPaket] = useState<PaketKey>(paketKey);
  const [nama, setNama] = useState('');
  const [waNum, setWaNum] = useState('');
  const [email, setEmail] = useState('');
  const [promo, setPromo] = useState('');
  const [touched, setTouched] = useState({ nama: false, waNum: false, email: false });
  const [submitting, setSubmitting] = useState(false);

  /* Sync ke URL ketika dropdown paket berubah */
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('paket', selectedPaket);
    window.history.replaceState({}, '', url.toString());
  }, [selectedPaket]);

  const paket = PAKET_DATA[selectedPaket];

  const errors = {
    nama: touched.nama && nama.trim().length < 3 ? 'Nama minimal 3 karakter' : '',
    waNum: touched.waNum && !validateWA(waNum) ? 'Nomor WhatsApp tidak valid' : '',
    email: touched.email && !validateEmail(email) ? 'Format email tidak valid' : '',
  };

  const isFormValid =
    nama.trim().length >= 3 && validateWA(waNum) && validateEmail(email);

  const handleSubmit = () => {
    setTouched({ nama: true, waNum: true, email: true });
    if (!isFormValid) return;

    setSubmitting(true);

    const waFormatted = waNum.replace(/^0/, '62').replace(/\D/g, '');
    const msg = paket.waMsg(nama.trim(), `+${waFormatted}`, email.trim(), promo.trim());
    const waUrl = `https://wa.me/${WA_ADMIN}?text=${msg}`;

    setTimeout(() => {
      setSubmitting(false);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }, 600);
  };

  return (
    <div className="order-root">
      {/* ── NAVBAR MINI ── */}
      <nav className="order-nav">
        <a href="/home" className="order-nav-logo">
          Journal<em>yze</em>
          <span className="order-nav-badge">v2.0</span>
        </a>
        <a href="/home" className="order-nav-back">← Kembali</a>
      </nav>

      {/* ── BODY ── */}
      <main className="order-main">
        {/* Page header */}
        <div className="order-header">
          <div className="order-header-tag">
            <span className="dot" />
            <span>Checkout Aman · Aktivasi Cepat</span>
          </div>
          <h1 className="order-headline">
            Dapatkan Akses <em>Journalyze</em>
          </h1>
          <p className="order-headline-sub">
            Isi data di bawah, kami akan kirim info pembayaran & aktivasi via WhatsApp.
          </p>
        </div>

        {/* ── TWO-COL LAYOUT ── */}
        <div className="order-layout">

          {/* ═══ LEFT: FORM ═══ */}
          <div className="order-form-col">
            <div className="order-card">
              <div className="order-card-head">
                <span className="order-card-title">📋 Data Pemesanan</span>
              </div>
              <div className="order-card-body">

                {/* Nama */}
                <div className={`order-field${errors.nama ? ' has-error' : ''}`}>
                  <label className="order-label">
                    Nama Lengkap <span className="req">*</span>
                  </label>
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
                  <label className="order-label">
                    Nomor WhatsApp <span className="req">*</span>
                  </label>
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
                  <div className="order-hint">Aktivasi akun akan dikirim ke nomor ini</div>
                </div>

                {/* Email */}
                <div className={`order-field${errors.email ? ' has-error' : ''}`}>
                  <label className="order-label">
                    Alamat Email <span className="req">*</span>
                  </label>
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

                {/* Paket dropdown */}
                <div className="order-field">
                  <label className="order-label">
                    Paket yang Dipilih <span className="req">*</span>
                  </label>
                  <select
                    className="order-select"
                    value={selectedPaket}
                    onChange={e => setSelectedPaket(e.target.value as PaketKey)}
                  >
                    <option value="basic">Paket Basic — Rp 99.000 (3 bulan)</option>
                    <option value="pro">Paket Pro — Rp 149.000 (Lifetime)</option>
                    <option value="elite">Paket Elite — Rp 249.000 (Lifetime + Review)</option>
                  </select>
                </div>

                {/* Kode promo */}
                <div className="order-field">
                  <label className="order-label">
                    Kode Promo <span className="optional">(opsional)</span>
                  </label>
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
                  aria-label="Lanjutkan ke WhatsApp"
                >
                  {submitting ? (
                    <>
                      <span className="order-spinner" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span>💬</span>
                      <span>Lanjutkan via WhatsApp</span>
                    </>
                  )}
                </button>

                <div className="order-secure-note">
                  <span>🔒</span>
                  <span>Data kamu aman · Tidak ada pembayaran di sini · Proses via WA</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: RINGKASAN PAKET ═══ */}
          <div className="order-summary-col">

            {/* Ringkasan harga */}
            <div className={`order-summary-card${selectedPaket === 'pro' ? ' highlight' : ''}`}>
              {paket.badge && (
                <div className="order-summary-badge">{paket.badge}</div>
              )}
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

            {/* Trust badges */}
            <div className="order-trust-box">
              <div className="order-trust-title">Mengapa Aman Pesan di Sini?</div>
              {[
                { icon: '⚡', text: 'Aktivasi cepat 1–2 jam di jam kerja' },
                { icon: '💬', text: 'Support langsung via WhatsApp' },
                { icon: '♾️', text: 'Lifetime — bayar sekali, pakai selamanya' },
                { icon: '🔒', text: 'Data trading tersimpan aman di cloud' },
              ].map(t => (
                <div key={t.text} className="order-trust-item">
                  <span className="order-trust-icon">{t.icon}</span>
                  <span>{t.text}</span>
                </div>
              ))}
            </div>

            {/* Tanya-tanya */}
            <div className="order-tanya-box">
              <div className="order-tanya-text">Masih ada pertanyaan?</div>
              <a
                href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent('Halo, saya ingin info lebih lanjut tentang Journalyze 🙏')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="order-tanya-btn"
              >
                <span>💬</span>
                <span>Chat Admin WhatsApp</span>
              </a>
            </div>

          </div>
        </div>
      </main>

      {/* ── FOOTER MINI ── */}
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

/* ── EXPORT DEFAULT dengan Suspense (wajib untuk useSearchParams di Next.js 14) ── */
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