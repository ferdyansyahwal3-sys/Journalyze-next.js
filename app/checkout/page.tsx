'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { _sb } from '@/lib/supabaseClient';
import './checkout.css';

const PAKET_DATA: Record<string, {
  label: string;
  durasi: string;
  harga: number;
  hargaDisp: string;
  hargaCoret: string;
  fitur: string[];
  badge: string | null;
}> = {
  basic: {
    label: 'Paket Basic',
    durasi: 'Akses 3 Bulan',
    harga: 99000,
    hargaDisp: 'Rp 99.000',
    hargaCoret: 'Rp 149.000',
    badge: null,
    fitur: [
      'Akses Journalyze Web App',
      'Kalkulator risiko & lot size',
      'Rekap & analisis trade dasar',
      'Trading plan harian',
    ],
  },
  pro: {
    label: 'Paket Pro',
    durasi: 'Akses Selamanya',
    harga: 149000,
    hargaDisp: 'Rp 149.000',
    hargaCoret: 'Rp 297.000',
    badge: '⭐ Paling Populer',
    fitur: [
      'Semua fitur Journalyze Web App',
      'Akses LIFETIME (bukan langganan)',
      'Filter & analisis bulanan/mingguan',
      'Analisis AI & foto MT5',
      '2 E-Book Trading Premium (Bonus)',
      'Akses grup komunitas trader',
      'Konsultasi 1x via WhatsApp',
    ],
  },
  elite: {
    label: 'Paket Elite',
    durasi: 'Akses Selamanya',
    harga: 249000,
    hargaDisp: 'Rp 249.000',
    hargaCoret: 'Rp 497.000',
    badge: '🔥 Terlengkap',
    fitur: [
      'Semua fitur Paket Pro',
      'Review journal bulanan (1x/bulan)',
      'Konsultasi trading 3x via WhatsApp',
      'Analisis psikologi trading',
      'Feedback strategy personal',
      'Prioritas support & update',
    ],
  },
};

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

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paketKey = searchParams.get('paket') || 'pro';
  const paket = PAKET_DATA[paketKey] || PAKET_DATA.pro;

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // Ambil data user dari Supabase
  useEffect(() => {
    _sb.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) {
        router.push('/order');
        return;
      }
      _sb.from('profiles')
        .select('display_name, email')
        .eq('id', u.id)
        .single()
        .then(({ data }) => {
          setUserName(data?.display_name || u.email?.split('@')[0] || 'Trader');
          setUserEmail(data?.email || u.email || '');
          setAuthChecked(true);
        });
    });
  }, []);

  // Load Midtrans Snap
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
    script.onload = () => setSnapLoaded(true);
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  const handleBayar = async () => {
    if (!snapLoaded) {
      setErrorMsg('Payment gateway belum siap, tunggu sebentar.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Kirim hanya paket — backend ambil user dari session
      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paket: paketKey,
          promo_code: promoCode.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memproses pembayaran.');
        setLoading(false);
        return;
      }

      setLoading(false);
      window.snap.pay(data.token, {
        onSuccess: () => router.push('/journal?payment=success'),
        onPending: () => router.push('/journal?payment=pending'),
        onError: () => setErrorMsg('Pembayaran gagal. Silakan coba lagi.'),
        onClose: () => {},
      });

    } catch {
      setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
        <div style={{ color: '#C9A84C', fontSize: 14, fontFamily: 'monospace' }}>Memuat...</div>
      </div>
    );
  }

  return (
    <div className="co-root">
      {/* Navbar */}
      <nav className="co-nav">
        <a href="/home" className="co-nav-logo">
          Journal<em>yze</em>
          <span className="co-nav-badge">v2.0</span>
        </a>
        <a href="/upgrade" className="co-nav-back">← Ganti Paket</a>
      </nav>

      <main className="co-main">
        {/* Breadcrumb */}
        <div className="co-breadcrumb">
          <span>Paket</span>
          <span className="co-bc-sep">›</span>
          <span className="co-bc-active">{paket.label}</span>
        </div>

        <div className="co-layout">
          {/* LEFT */}
          <div className="co-left">
            {paket.badge && <div className="co-paket-badge">{paket.badge}</div>}
            <div className="co-paket-tag">PAKET MEMBERSHIP</div>
            <h1 className="co-paket-name">{paket.label}</h1>

            <div className="co-meta">
              <div className="co-meta-item">
                <div className="co-meta-label">Masa akses</div>
                <div className="co-meta-value">{paket.durasi}</div>
              </div>
              <div className="co-meta-item">
                <div className="co-meta-label">Tipe paket</div>
                <div className="co-meta-value">{paketKey === 'basic' ? 'Fixed Period' : 'Lifetime'}</div>
              </div>
            </div>

            <div className="co-fitur-title">Yang kamu dapatkan</div>
            <div className="co-fitur-list">
              {paket.fitur.map((f) => (
                <div key={f} className="co-fitur-item">
                  <span className="co-check">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div className="co-trust">
              {[
                { icon: '⚡', text: 'Aktivasi otomatis setelah bayar' },
                { icon: '🔒', text: 'Pembayaran aman via Midtrans' },
                { icon: '💬', text: 'Support via WhatsApp' },
              ].map(t => (
                <div key={t.text} className="co-trust-item">
                  <span>{t.icon}</span><span>{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div className="co-right">
            <div className="co-card">

              {/* Sapaan */}
              <div className="co-greeting">
                <div className="co-greeting-avatar">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="co-greeting-name">Halo, <span>{userName}</span>! 👋</div>
                  <div className="co-greeting-email">{userEmail}</div>
                </div>
              </div>

              <div className="co-divider" />

              {/* Harga */}
              <div className="co-total-label">Total Pembayaran</div>
              <div className="co-harga-coret">{paket.hargaCoret}</div>
              <div className="co-harga">{paket.hargaDisp}</div>
              <div className="co-harga-sub">
                {paketKey === 'basic' ? 'Dibayar sekali untuk akses 3 bulan.' : 'Dibayar sekali untuk akses selamanya.'}
              </div>

              <div className="co-divider" />

              {/* Kode promo */}
              <div className="co-promo-label">Kode Promo <span className="co-optional">(opsional)</span></div>
              <div className="co-promo-wrap">
                <input
                  type="text"
                  className="co-promo-input"
                  placeholder="Contoh: TRADER50"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
                <button className="co-promo-btn" type="button">Terapkan</button>
              </div>

              <div className="co-divider" />

              {/* Rincian */}
              <div className="co-rincian">
                <div className="co-rincian-row">
                  <span>Harga paket</span>
                  <span>{paket.hargaDisp}</span>
                </div>
                <div className="co-rincian-row co-rincian-total">
                  <span>Total</span>
                  <span>{paket.hargaDisp}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="co-error">⚠️ {errorMsg}</div>
              )}

              {/* CTA */}
              <button
                className="co-bayar-btn"
                onClick={handleBayar}
                disabled={loading || !snapLoaded}
              >
                {loading ? (
                  <><span className="co-spinner" /> Memproses...</>
                ) : (
                  <>💳 Bayar Sekarang — {paket.hargaDisp}</>
                )}
              </button>

              <div className="co-secure">
                <span>🔒</span>
                <span>Akses terbuka otomatis setelah pembayaran diterima. Tidak ada biaya tersembunyi.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
        <div style={{ color: '#C9A84C', fontSize: 14 }}>Memuat...</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
