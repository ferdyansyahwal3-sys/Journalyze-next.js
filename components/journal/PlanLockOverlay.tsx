'use client';

// components/journal/PlanLockOverlay.tsx
interface PlanLockOverlayProps {
  feature?: string;
  userEmail?: string;
}

export default function PlanLockOverlay({
  feature = 'Fitur ini',
  userEmail = '',
}: PlanLockOverlayProps) {
  const handleUpgrade = () => {
    window.location.href = `/upgrade${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''}`;
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // Transparan di atas, gelap di bawah — fitur keliatan tapi dikunci
      background: 'linear-gradient(to bottom, rgba(8,8,8,0.15) 0%, rgba(8,8,8,0.5) 40%, rgba(8,8,8,0.92) 70%, rgba(8,8,8,0.98) 100%)',
      borderRadius: 'inherit',
      padding: '24px',
      textAlign: 'center',
      backdropFilter: 'blur(1px)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{
        color: '#C9A84C',
        fontSize: 15,
        fontWeight: 700,
        marginBottom: 8,
        letterSpacing: 0.3,
      }}>
        {feature} — Paket Pro & Elite
      </div>
      <div style={{
        color: '#777',
        fontSize: 12,
        maxWidth: 280,
        lineHeight: 1.6,
        marginBottom: 20,
      }}>
        Upgrade untuk unlock filter, analisis AI, foto MT5, dan semua fitur premium lainnya.
      </div>
      <button
        onClick={handleUpgrade}
        style={{
          background: '#C9A84C',
          color: '#000',
          border: 'none',
          borderRadius: 8,
          padding: '11px 28px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          letterSpacing: 0.5,
        }}
      >
        Upgrade Sekarang →
      </button>
    </div>
  );
}
