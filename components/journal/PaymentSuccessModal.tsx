'use client';

// components/journal/PaymentSuccessModal.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJournalStore } from '@/store/useJournalStore';

export default function PaymentSuccessModal() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  
  const showToast = useJournalStore((s) => s.showToast);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setVisible(true);
      // Bersihkan query param dari URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleStart = () => {
    // Upgrade plan di store (webhook sudah update DB, tinggal update UI)
    
    showToast('🎉 Selamat datang di Journalyze Premium!', 'success');
    setVisible(false);
    // Reload halaman biar data real dari Supabase ke-load
    window.location.href = '/journal';
  };

  if (!visible) return null;

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
      {/* Confetti dots (CSS only) */}
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

      {/* Simple confetti */}
      {['#C9A84C','#fff','#f1c40f','#C9A84C','#e67e22','#fff'].map((color, i) => (
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
        {/* Icon */}
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>

        {/* Title */}
        <h2 style={{
          color: '#C9A84C',
          fontSize: 22,
          fontWeight: 700,
          margin: '0 0 12px',
        }}>
          Selamat! Akun Kamu Sudah Aktif
        </h2>

        {/* Subtitle */}
        <p style={{
          color: '#aaa',
          fontSize: 14,
          lineHeight: 1.7,
          margin: '0 0 28px',
        }}>
          Pembayaran berhasil dikonfirmasi. Kamu sekarang punya akses penuh ke{' '}
          <strong style={{ color: '#C9A84C' }}>Journalyze Pro</strong> — catat trade pertamamu sekarang!
        </p>

        {/* Divider */}
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

        {/* CTA */}
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
          Mulai Journaling Sekarang →
        </button>

        <div style={{ color: '#444', fontSize: 11, marginTop: 16 }}>
          Email konfirmasi sudah dikirim ke inbox kamu
        </div>
      </div>
    </div>
  );
}
