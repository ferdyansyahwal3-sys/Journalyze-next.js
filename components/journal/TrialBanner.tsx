'use client';

// components/journal/TrialBanner.tsx
// Strip tipis di atas aplikasi untuk user plan Trial: countdown sisa waktu + tombol Upgrade.
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useJournalStore } from '@/store/useJournalStore';

const BANNER_HEIGHT = 41; // sama dengan DemoBanner

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TrialBanner() {
  const router = useRouter();
  const userPlan      = useJournalStore((s) => s.userPlan);
  const planExpiresAt = useJournalStore((s) => s.planExpiresAt);

  const [dismissed, setDismissed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const reloadedRef = useRef(false);

  const visible = userPlan === 'trial' && !!planExpiresAt;

  // Countdown per detik. Saat habis → reload agar useJournalAuth cek expiry & downgrade ke free.
  useEffect(() => {
    if (!visible || !planExpiresAt) return;
    const target = new Date(planExpiresAt).getTime();
    if (isNaN(target)) return;

    const tick = () => {
      const left = target - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0 && !reloadedRef.current) {
        reloadedRef.current = true;
        // Guard: maksimal 1x reload per 15 detik supaya tidak looping kalau downgrade gagal
        try {
          const last = Number(sessionStorage.getItem('jz_trial_reload_at') || '0');
          if (Date.now() - last < 15000) return;
          sessionStorage.setItem('jz_trial_reload_at', String(Date.now()));
        } catch {}
        window.location.reload();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, planExpiresAt]);

  // Geser topbar ke bawah banner saat tampil, kembalikan saat ditutup / unmount
  useEffect(() => {
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!topbar) return;
    topbar.style.top = visible && !dismissed ? `${BANNER_HEIGHT}px` : '0';
    return () => {
      topbar.style.top = '0';
    };
  }, [visible, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <>
      {/* Spacer supaya konten tidak tertutup banner + topbar */}
      <div style={{ height: BANNER_HEIGHT }} />

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 400, // di atas topbar (300) dan bottom nav (399)
        height: BANNER_HEIGHT,
        background: 'var(--bg3)',
        borderBottom: '1px solid var(--gold-bd)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 15 }}>🎁</span>
          <span style={{
            color: 'var(--text)', fontSize: 13, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Trial aktif — sisa{' '}
            <strong style={{
              color: 'var(--gold2)',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: 0.5,
            }}>
              {remaining == null ? '--:--:--' : formatRemaining(remaining)}
            </strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => router.push('/upgrade')}
            style={{
              background: 'var(--gold)',
              color: '#080808',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="Tutup"
            aria-label="Tutup banner trial"
            style={{
              background: 'transparent',
              color: 'var(--text3)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
