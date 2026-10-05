// components/delivery/DeliveryPage.tsx
// Refactor: tidak lagi decode token sendiri — semua validasi ada di server
// (app/delivery/page.tsx). Komponen ini hanya render berdasarkan props.
'use client';

import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';
import LicenseKeyBox from './LicenseKeyBox';
import StepCard from './StepCard';

type DeliveryStatus = 'valid' | 'used' | 'revoked' | 'invalid';

interface Props {
  status: DeliveryStatus;
  licenseKey?: string;
  customerName?: string;
}

function ErrorPage({ title, desc }: { title: string; desc: string }) {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48 }}>🔒</div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p style={{ opacity: 0.6, maxWidth: 360, margin: 0 }}>{desc}</p>
    </section>
  );
}

export default function DeliveryPage({ status, licenseKey = '', customerName = '' }: Props) {
  useRevealOnScroll([licenseKey]);

  if (status === 'invalid') {
    return (
      <ErrorPage
        title="Link Tidak Valid"
        desc="Link delivery ini tidak valid atau sudah rusak. Hubungi admin jika kamu yakin sudah membeli."
      />
    );
  }

  if (status === 'revoked') {
    return (
      <ErrorPage
        title="Akses Dicabut"
        desc="License key ini telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut."
      />
    );
  }

  if (status === 'used') {
    return (
      <ErrorPage
        title="Akses Sudah Digunakan"
        desc={`License key ${licenseKey} sudah diaktifkan ke akun lain. Hubungi admin jika ini bukan kamu.`}
      />
    );
  }

  // status === 'valid'
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-grid"></div>
        <div className="hero-glow"></div>
        <div className="orb1"></div>
        <div className="orb2"></div>
        <div className="hero-inner">
          <span className="hero-celebrate">🎉</span>
          <div className="status-pill">
            <span className="status-dot"></span>
            Pembayaran Berhasil · Akses Aktif
          </div>
          <h1>
            <span className="l1">Selamat Datang di</span>
            <span className="l2">Journalyze!</span>
          </h1>
          <p className="hero-desc">
            Terima kasih sudah mempercayai <strong>Journalyze</strong> sebagai jurnal trading kamu. License key unik
            milikmu sudah siap di bawah ini.
          </p>
          <div className="order-card">
            <div className="order-check">✓</div>
            <div className="order-body">
              <div className="order-lbl">✦ ORDER CONFIRMED</div>
              <div className="order-title">Journalyze Web App — Full Package</div>
              <div className="order-sub">
                Jurnal Trading + 2 E-Book + Komunitas + Free Update <strong>Seumur Hidup</strong>
              </div>
            </div>
          </div>
          <div className="scroll-hint">
            <div className="scroll-arrow">
              <span></span>
              <span></span>
              <span></span>
            </div>
            Scroll untuk akses produk kamu
            <div className="scroll-arrow">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ACCESS SECTION */}
      <section className="access-sec" id="akses">
        <div className="access-inner">
          <div className="reveal" style={{ marginBottom: 48 }}>
            <div className="sec-lbl">Akses Produk Kamu</div>
            <h2 className="sec-title">
              Semua yang kamu
              <br />
              dapat <em>ada di sini.</em>
            </h2>
            <p className="sec-sub">Ikuti langkah-langkah di bawah ini. Simpan halaman ini baik-baik.</p>
          </div>

          <LicenseKeyBox licenseKey={licenseKey} customerName={customerName} isExpired={false} />

          <div className="steps-wrap reveal">
            <StepCard
              num={2}
              badgeClass="badge-bonus"
              badgeLabel="✨ BONUS E-BOOK #1"
              title="E-Book Candlestick Pattern"
              desc="Panduan lengkap 12+ pola candlestick dengan contoh nyata, cara entry, SL, TP, dan kombinasi dengan Support & Resistance."
              note="Klik link untuk menyimpan salinan E-Book Candlestick pribadi kamu."
              href="https://drive.google.com/uc?export=download&id=1awMIAUKsxRKkz4y71O4VXriDMjzWsNnV"
              btnClass="green-btn"
              btnIcon="📊"
              btnLabel="Akses E-Book"
            />
            <StepCard
              num={3}
              badgeClass="badge-bonus"
              badgeLabel="✨ BONUS E-BOOK #2"
              title="E-Book Support & Resistance"
              desc="Panduan lengkap cara menentukan S&R, role reversal, bounce vs breakout, 3 strategi trading, dan multi timeframe analysis."
              note="Klik link untuk menyimpan salinan E-Book S&R pribadi kamu."
              href="https://drive.google.com/uc?export=download&id=1LF8C84FJImpw2QidWRaDUFxK0m17-dL4"
              btnClass="blue-btn"
              btnIcon="📈"
              btnLabel="Akses E-Book"
            />
            <StepCard
              num={4}
              badgeClass="badge-comm"
              badgeLabel="💬 BONUS KOMUNITAS"
              title="Grup Komunitas & Konsultasi Eksklusif"
              desc="Bergabung dengan trader aktif Indonesia. Diskusi harian, sharing strategi, evaluasi bareng, dan konsultasi personal langsung dari tim Journalyze."
              note="Klik link agar kamu punya akses grup komunitas & konsultasi."
              href="https://chat.whatsapp.com/ElTxKk7yP68CcRr6mf9T87?mode=gi_t"
              btnClass="purple-btn"
              btnIcon="💬"
              btnLabel="Gabung Komunitas"
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-sec">
        <div className="footer-logo">
          Journal<em>yze</em>
        </div>
        <div className="footer-note">
          Simpan halaman ini baik-baik sebagai bukti pembelian.
          <br />
          License key hanya bisa digunakan untuk 1 akun.
          <br />
          <br />
          © 2025 Journalyze · Trading Journal Suite
        </div>
      </footer>
    </>
  );
}
