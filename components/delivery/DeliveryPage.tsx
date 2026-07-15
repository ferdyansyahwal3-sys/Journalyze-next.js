// components/delivery/DeliveryPage.tsx
// Dipindah dari delivery.html baris 136-298 (markup) + baris 330-357
// (baca token/legacy params dari URL). Logic decode token 100% sama,
// termasuk backward-compat untuk URL lama (?key=&name=).
'use client';

import { useSearchParams } from 'next/navigation';
import { decodeDeliveryToken } from '@/lib/deliveryToken';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';
import LicenseKeyBox from './LicenseKeyBox';
import StepCard from './StepCard';

export default function DeliveryPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const legacyKey = params.get('key'); // backward compat URL lama
  const legacyName = params.get('name');

  let licenseKey = 'TIDAK DITEMUKAN';
  let customerName = '';
  let isExpired = false;

  if (token) {
    const result = decodeDeliveryToken(token);
    if (!result) {
      licenseKey = 'TOKEN TIDAK VALID';
    } else {
      licenseKey = result.key;
      customerName = result.name || '';
      isExpired = result.expired;
    }
  } else if (legacyKey) {
    licenseKey = legacyKey;
    customerName = legacyName || '';
  }

  useRevealOnScroll([licenseKey]);

  return (
    <>
      {/* HERO — delivery.html baris 138-171 */}
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

      {/* ACCESS SECTION — delivery.html baris 173-287 */}
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

          <LicenseKeyBox licenseKey={licenseKey} customerName={customerName} isExpired={isExpired} />

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

      {/* FOOTER — delivery.html baris 290-297 */}
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
