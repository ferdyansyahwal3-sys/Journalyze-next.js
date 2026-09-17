'use client';

// components/journal/DemoBanner.tsx
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const BANNER_HEIGHT = 41;

export default function DemoBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // Geser topbar ke bawah banner saat mount, kembalikan saat dismiss
  useEffect(() => {
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!topbar) return;
    if (!dismissed) {
      topbar.style.top = `${BANNER_HEIGHT}px`;
    } else {
      topbar.style.top = '0';
    }
    return () => {
      topbar.style.top = '0';
    };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <>
      {/* Spacer supaya konten tidak tertutup banner + topbar */}
      <div style={{ height: BANNER_HEIGHT }} />

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 400, // lebih tinggi dari topbar (300) dan bottom nav (399)
        height: BANNER_HEIGHT,
        background: 'linear-gradient(90deg, #1a1200, #2a1e00)',
        borderBottom: '1px solid #C9A84C44',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>👀</span>
          <span style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>
            Kamu sedang melihat{' '}
            <strong style={{ color: '#C9A84C' }}>data demo</strong>.
            {' '}Data tidak tersimpan — upgrade untuk mulai journaling sungguhan.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => router.push('/upgrade')}
            style={{
              background: '#C9A84C',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade Sekarang
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              color: '#555',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px',
            }}
            title="Tutup"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}