'use client';
/**
 * components/live/LiveLoadingSkeleton.tsx
 * Phase 10
 *
 * Skeleton loading — pakai class .live-skeleton dari live.css
 * dan .stat-row / .scard dari design system yang sama.
 */

export function LiveLoadingSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Topbar skeleton */}
      <div className="topbar">
        <div className="live-skeleton" style={{ width: 140, height: 22, borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="live-skeleton" style={{ width: 60, height: 26, borderRadius: 5 }} />
          ))}
        </div>
        <div className="live-skeleton" style={{ width: 80, height: 26, borderRadius: 99 }} />
      </div>

      {/* Readonly bar skeleton */}
      <div className="live-skeleton" style={{ height: 34, borderRadius: 0 }} />

      {/* Main content */}
      <div className="main">
        {/* Page header */}
        <div style={{ marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 18 }}>
          <div className="live-skeleton" style={{ width: 80, height: 10, marginBottom: 10, borderRadius: 4 }} />
          <div className="live-skeleton" style={{ width: 260, height: 30, marginBottom: 8, borderRadius: 6 }} />
          <div className="live-skeleton" style={{ width: 180, height: 14, borderRadius: 4 }} />
        </div>

        {/* Stat cards */}
        <div className="stat-row" style={{ marginBottom: 20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="live-skeleton scard" style={{ height: 72 }} />
          ))}
        </div>

        {/* Box skeleton */}
        <div className="box" style={{ marginBottom: 16 }}>
          <div className="box-head">
            <div className="live-skeleton" style={{ width: 120, height: 12, borderRadius: 4 }} />
          </div>
          <div className="box-body">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="live-skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}