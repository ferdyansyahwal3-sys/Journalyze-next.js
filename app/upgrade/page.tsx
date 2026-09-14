'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import './upgrade.css';

const PAKETS = [
  {
    key: 'basic',
    label: 'Paket Basic',
    paketLabel: 'PAKET BASIC',
    durasi: 'Akses 3 Bulan',
    hargaCoret: 'Rp 149.000',
    harga: 'Rp 99.000',
    desc: 'Cocok untuk trader pemula yang baru mulai journaling.',
    badge: null,
    highlight: false,
    fitur: [
      'Akses Journalyze Web App',
      'Kalkulator risiko & lot size',
      'Rekap & analisis trade dasar',
      'Trading plan harian',
    ],
  },
  {
    key: 'pro',
    label: 'Paket Pro',
    paketLabel: 'PAKET PRO',
    durasi: 'Akses Selamanya',
    hargaCoret: 'Rp 297.000',
    harga: 'Rp 149.000',
    desc: 'Paling populer. Akses lifetime + semua fitur analisis.',
    badge: '⭐ Paling Populer',
    highlight: true,
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
  },
  {
    key: 'elite',
    label: 'Paket Elite',
    paketLabel: 'PAKET ELITE',
    durasi: 'Akses Selamanya',
    hargaCoret: 'Rp 497.000',
    harga: 'Rp 249.000',
    desc: 'Lengkap dengan review journal dan konsultasi personal.',
    badge: '🔥 Terlengkap',
    highlight: false,
    fitur: [
      'Semua fitur Paket Pro',
      'Review journal bulanan (1x/bulan)',
      'Konsultasi trading 3x via WhatsApp',
      'Analisis psikologi trading',
      'Feedback strategy personal',
      'Prioritas support & update',
    ],
  },
];

function UpgradeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePilih = (key: string) => {
    setLoading(key);
    router.push(`/checkout?paket=${key}`);
  };

  return (
    <div className="up-root">
      {/* Navbar — FIX #1: logo markup sama dengan halaman journal */}
      <nav className="up-nav">
        <a href="/home" className="up-nav-logo">
          <span className="up-nav-logo-text">Journal</span>
          <span className="up-nav-logo-em">yze</span>
          <span className="up-nav-badge">v2.0</span>
        </a>
        <a href="/home" className="up-nav-back">← Kembali ke Jurnal</a>
      </nav>

      <main className="up-main">
        {/* Header */}
        <div className="up-header">
          <div className="up-header-tag">
            <span className="dot" />
            Pilih Paket yang Tepat
          </div>
          <h1 className="up-headline">
            Tingkatkan Trading Kamu dengan <em>Journalyze</em>
          </h1>
          <p className="up-sub">
            Satu kali bayar, akses selamanya. Tidak ada biaya langganan tersembunyi.
          </p>
        </div>

        {/* Grid — FIX #2: lebih lebar, padding lebih besar */}
        <div className="up-grid">
          {PAKETS.map((p) => (
            <div
              key={p.key}
              className={`up-card${p.highlight ? ' highlight' : ''}`}
            >
              {p.badge && <div className="up-badge">{p.badge}</div>}

              <div className="up-card-top">
                <div className="up-paket-label">{p.paketLabel}</div>
                <div className="up-durasi">{p.durasi}</div>
                <div className="up-harga-coret">{p.hargaCoret}</div>
                <div className="up-harga">{p.harga}</div>
                <p className="up-desc">{p.desc}</p>
              </div>

              <div className="up-divider" />

              <div className="up-fitur">
                <div className="up-fitur-title">Yang kamu dapatkan:</div>
                <ul className="up-fitur-list">
                  {p.fitur.map((f) => (
                    <li key={f} className="up-fitur-item">
                      <span className="up-check">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={`up-btn${p.highlight ? ' gold' : ''}`}
                onClick={() => handlePilih(p.key)}
                disabled={loading === p.key}
              >
                {loading === p.key ? 'Memproses...' : `Pilih ${p.label} →`}
              </button>
            </div>
          ))}
        </div>

        {/* Trust */}
        <div className="up-trust">
          {[
            { icon: '⚡', text: 'Aktivasi otomatis setelah bayar' },
            { icon: '🔒', text: 'Pembayaran aman via Midtrans' },
            { icon: '♾️', text: 'Lifetime — bayar sekali, pakai selamanya' },
            { icon: '💬', text: 'Support via WhatsApp' },
          ].map((t) => (
            <div key={t.text} className="up-trust-item">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        {/* Lisensi */}
        <div className="up-license">
          Punya kode lisensi dari Lynk.id/Scalev?{' '}
          <a href="/delivery">Aktivasi di sini</a>
        </div>
      </main>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
        <div style={{ color: '#C9A84C', fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}>Memuat...</div>
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  );
}
