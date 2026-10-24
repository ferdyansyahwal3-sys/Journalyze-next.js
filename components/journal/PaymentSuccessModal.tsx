'use client';

// components/journal/PaymentSuccessModal.tsx
import { useEffect, useRef, useState } from 'react';
import { useJournalStore } from '@/store/useJournalStore';

type Phase = 'verifying' | 'success' | 'pending' | 'failed';

const PLAN_LABEL: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  elite: 'Elite',
};

export default function PaymentSuccessModal() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('verifying');
  const [plan, setPlan] = useState<string | null>(null);
  const started = useRef(false); // cegah double-run (React StrictMode di dev)

  const showToast = useJournalStore((s) => s.showToast);

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    started.current = true;

    const orderId = params.get('order_id');
    setVisible(true);

    // Bersihkan query param dari URL
    const url = new URL(window.location.href);
    ['payment', 'order_id', 'status_code', 'transaction_status'].forEach((k) =>
      url.searchParams.delete(k)
    );
    window.history.replaceState({}, '', url.toString());

    // Tanpa order_id (mis. redirect lama): percaya alur webhook seperti sebelumnya
    if (!orderId) {
      setPhase('success');
      return;
    }

    // Tanya server → server tanya Midtrans → paket diaktifkan. Coba ulang beberapa kali
    // karena status bisa masih "pending" beberapa detik setelah popup sukses.
    (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const res = await fetch('/api/midtrans/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId }),
          });
          const data = await res.json();
          if (data.status === 'paid') {
            setPlan(data.plan || null);
            setPhase('success');
            return;
          }
          if (data.status === 'failed') {
            setPhase('failed');
            return;
          }
        } catch {
          /* coba lagi */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPhase('pending');
    })();
  }, []);

  const handleStart = () => {
    if (phase === 'success') {
      showToast('🎉 Selamat datang di Journalyze Premium!', 'success');
    }
    setVisible(false);
    // Reload halaman biar data real (plan terbaru) dari Supabase ke-load
    window.location.href = '/journal';
  };

  if (!visible) return null;

  const planName = plan ? PLAN_LABEL[plan] || plan.toUpperCase() : 'Premium';

  const content = {
    verifying: {
      icon: '⏳',
      title: 'Memverifikasi Pembayaran...',
      body: 'Mohon tunggu sebentar, kami sedang memastikan pembayaran kamu dan mengaktifkan paket.',
      cta: null as string | null,
    },
    success: {
      icon: '🎉',
      title: 'Selamat! Akun Kamu Sudah Aktif',
      body: null,
      cta: 'Mulai Journaling Sekarang →',
    },
    pending: {
      icon: '🕐',
      title: 'Pembayaran Belum Terkonfirmasi',
      body: 'Pembayaran kamu belum terkonfirmasi oleh Midtrans. Kalau kamu sudah membayar, paket akan aktif otomatis dalam beberapa menit. Muat ulang halaman ini nanti, atau hubungi support via WhatsApp.',
      cta: 'Muat Ulang',
    },
    failed: {
      icon: '⚠️',
      title: 'Pembayaran Tidak Berhasil',
      body: 'Transaksi ini dibatalkan atau kedaluwarsa. Kamu bisa mencoba lagi dari halaman upgrade.',
      cta: 'Kembali ke Jurnal',
    },
  }[phase];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Confetti dots (CSS only) — hanya saat sukses */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-dot {
          position: fixed;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confettiFall linear infinite;
          pointer-events: none;
        }
      `}</style>

      {phase === 'success' &&
        ['#C9A84C', '#fff', '#f1c40f', '#C9A84C', '#e67e22', '#fff'].map((color, i) => (
          <div key={i} className="confetti-dot" style={{
            background: color,
            left: `${10 + i * 15}%`,
            top: '-10px',
            animationDuration: `${1.5 + i * 0.3}s`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}

      <div style={{
        background: '#111',
        border: '1px solid #C9A84C44',
        borderRadius: 20,
        padding: '40px 32px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        zIndex: 201,
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{content.icon}</div>

        <h2 style={{
          color: '#C9A84C',
          fontSize: 22,
          fontWeight: 700,
          margin: '0 0 12px',
        }}>
          {content.title}
        </h2>

        <p style={{
          color: '#aaa',
          fontSize: 14,
          lineHeight: 1.7,
          margin: '0 0 28px',
        }}>
          {phase === 'success' ? (
            <>
              Pembayaran berhasil dikonfirmasi. Kamu sekarang punya akses penuh ke{' '}
              <strong style={{ color: '#C9A84C' }}>Journalyze {planName}</strong> — catat trade pertamamu sekarang!
            </>
          ) : (
            content.body
          )}
        </p>

        {phase === 'success' && (
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #222',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <span style={{ color: '#ccc', fontSize: 13, textAlign: 'left' }}>
              Data demo telah dihapus. Jurnal kamu siap digunakan dengan data trading sungguhan.
            </span>
          </div>
        )}

        {content.cta && (
          <button
            onClick={handleStart}
            style={{
              width: '100%',
              background: '#C9A84C',
              color: '#000',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            {content.cta}
          </button>
        )}

        {phase === 'success' && (
          <div style={{ color: '#444', fontSize: 11, marginTop: 16 }}>
            Email konfirmasi sudah dikirim ke inbox kamu
          </div>
        )}
      </div>
    </div>
  );
}
