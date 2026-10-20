// components/admin/BottomNav.tsx
// 5 item dalam 1 pill, tanpa label, scroll shrink via window scroll
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminStore, type MainTab } from '@/store/useAdminStore';

const Icons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  ),
  marketing: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  affiliate: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <path d="M8.59 13.51 15.42 17.49"/><path d="M15.41 6.51 8.59 10.49"/>
    </svg>
  ),
  pixel: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  ),
};

const NAV_ITEMS: { id: MainTab; label: string }[] = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'users',      label: 'Users'      },
  { id: 'marketing',  label: 'Marketing'  },
  { id: 'affiliate',  label: 'Affiliate'  },
  { id: 'pixel',      label: 'Pixel'      },
];

export default function BottomNav() {
  const activeTab    = useAdminStore((s) => s.activeTab);
  const setActiveTab = useAdminStore((s) => s.setActiveTab);
  const [shrunk, setShrunk] = useState(false);

  const lastY    = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach ke window scroll — paling reliable di semua device
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current && y > 60) {
        setShrunk(true);
      } else if (y < lastY.current) {
        setShrunk(false);
      }
      lastY.current = y;

      // Auto-restore setelah berhenti scroll
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShrunk(false), 1200);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <nav className={`bottom-nav${shrunk ? ' shrunk' : ''}`}>
      <div className="bn-pill">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`bn-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
          >
            <span className="bn-icon">{Icons[item.id]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}