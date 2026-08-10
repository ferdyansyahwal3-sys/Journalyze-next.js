'use client';
/**
 * components/demo/DemoBanner.tsx
 * Banner sticky di atas topbar — info demo mode
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  const router = useRouter();

  if (hidden) return null;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 9999,
      background: 'linear-gradient(90deg, rgba(201,168,76,0.15), rgba(201,168,76,0.08))',
      borderBottom: '1px solid var(--gold-bd)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>🧪</span>
        <div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: 'var(--gold2)',
            fontWeight: 700,
          }}>
            Mode Demo
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 10 }}>
            Data tersimpan di browser kamu · tidak tersinkron ke cloud · gratis selamanya
          </span>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '5px 14px',
            borderRadius: 6,
            background: 'var(--gold)',
            border: 'none',
            color: '#080808',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Daftar Gratis →
        </button>
        <button
          onClick={() => setHidden(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 6px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}