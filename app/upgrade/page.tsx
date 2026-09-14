'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import './upgrade.css';

const PAKET_DATA = [
  {
    key: 'basic',
    label: 'Paket Basic',
    durasi: 'Akses 3 Bulan',
    harga: 99000,
    hargaDisp: 'Rp 99.000',
    hargaCoret: 'Rp 149.000',
    deskripsi: 'Cocok untuk trader pemula yang baru mulai journaling.',
    fitur: [
      'Akses Journalyze Web App',
      'Kalkulator risiko & lot size',
      'Rekap & analisis trade dasar',
      'Trading plan harian',
    ],
    badge: null,
    highlight: false,
  },
  {
    key: 'pro',
    label: 'Paket Pro',
    durasi: 'Akses Selamanya',
    harga: 149000,
    hargaDisp: 'Rp 149.000',
    hargaCoret: 'Rp 297.000',
    deskripsi: 'Paling populer. Akses lifetime + semua fitur analisis.',
    fitur: [
      'Semua fitur Journalyze Web App',
      'Akses LIFETIME (bukan langganan)',
      'Filter & analisis bulanan/mingguan',
      'Analisis AI & foto MT5',
      '2 E-Book Trading Premium (Bonus)',
      'Akses grup komunitas trader',
      'Konsultasi 1x via WhatsApp',
      'Semua update fitur gratis',
    ],
    badge: '⭐ Paling Populer',
    highlight: true,
  },
  {
    key: 'elite',
    label: 'Paket Elite',
    durasi: 'Akses Selamanya',
    harga: 249000,
    hargaDisp: 'Rp 249.000',
    hargaCoret: 'Rp 497.000',
    deskripsi: 'Lengkap dengan review journal dan konsultasi personal.',
    fitur: [
      'Semua fitur Paket Pro',
      'Review journal bulanan (1x/bulan)',
      'Konsultasi trading 3x via WhatsApp',
      'Analisis psikologi trading',
      'Feedback strategy personal',
      'Prioritas support & update',
    ],
    badge: '🔥 Terlengkap',
    highlight: false,
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePilih = (key: string) => {
    setLoading(key);
    router.push(`/checkout?paket=${key}`);
  };

  return (
    <div className="upgrade-root">
      {/* Navbar */}
      <nav className="upgrade-nav">
        <a href="/home" className="upgrade-nav-logo">
          Journal<em>yze</em>
          <span className="upgrade-nav-badge">v2.0</span>
        </a>
        <a href="/journal" className="upgrade-nav-back">← Kembali ke Jurnal</a>
      </nav>

      <main className="upgrade-main">
        {/* Header */}
        <div className="upgrade-header">
          <div className="upgrade-header-tag">
            <span className="dot" />
            <span>Pilih Paket yang Tepat</span>
          </div>
          <h1 className="upgrade-headline">
            Tingkatkan Trading Kamu dengan <em>Journalyze</em>
          </h1>
          <p className="upgrade-sub">
            Satu kali bayar, akses selamanya. Tidak ada biaya langganan tersembunyi.
          </p>
        </div>

        {/* Paket Grid */}
        <div className="upgrade-grid">
          {PAKET_DATA.map((p) => (
            <div
              key={p.key}
              className={`upgrade-card${p.highlight ? ' highlight' : ''}`}
            >
              {p.badge && (
                <div className="upgrade-badge">{p.badge}</div>
              )}

              <div className="upgrade-card-top">
                <div className="upgrade-paket-label">{p.label}</div>
                <div className="upgrade-durasi">{p.durasi}</div>
                <div className="upgrade-harga-coret">{p.hargaCoret}</div>
                <div className="upgrade-harga">{p.hargaDisp}</div>
                <p className="upgrade-desc">{p.deskripsi}</p>
              </div>

              <div className="upgrade-divider" />

              <div className="upgrade-fitur">
                <div className="upgrade-fitur-title">Yang kamu dapatkan:</div>
                {p.fitur.map((f) => (
                  <div key={f} className="upgrade-fitur-item">
                    <span className="upgrade-check">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <button
                className={`upgrade-btn${p.highlight ? ' gold' : ''}`}
                onClick={() => handlePilih(p.key)}
                disabled={loading === p.key}
              >
                {loading === p.key ? 'Memproses...' : `Pilih ${p.label} →`}
              </button>
            </div>
          ))}
        </div>

        {/* Trust */}
        <div className="upgrade-trust">
          {[
            { icon: '⚡', text: 'Aktivasi otomatis setelah bayar' },
            { icon: '🔒', text: 'Pembayaran aman via Midtrans' },
            { icon: '♾️', text: 'Lifetime — bayar sekali, pakai selamanya' },
            { icon: '💬', text: 'Support via WhatsApp' },
          ].map((t) => (
            <div key={t.text} className="upgrade-trust-item">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        {/* Punya kode lisensi */}
        <div className="upgrade-license">
          Punya kode lisensi dari Lynk.id/Scalev?{' '}
          <a href="/delivery">Aktivasi di sini</a>
        </div>
      </main>
    </div>
  );
}
