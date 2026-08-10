'use client';
/**
 * components/live/LiveErrorState.tsx
 * Phase 10
 */

interface Props {
  icon?: string;
  title: string;
  message: string;
}

export function LiveErrorState({ icon = '⚠️', title, message }: Props) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="live-error-wrap">
        <div className="live-error-icon">{icon}</div>
        <h2 className="live-error-title">{title}</h2>
        <p className="live-error-msg">{message}</p>
      </div>
    </div>
  );
}