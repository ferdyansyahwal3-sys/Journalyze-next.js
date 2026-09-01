'use client'
// components/journal/ShareLiveModal.tsx
// Modal: tampilkan link share, toggle aktif/nonaktif, copy URL

import { useState, useEffect, useRef } from 'react'
import type { UseShareLiveReturn } from '@/hooks/useShareLive'

interface Props extends UseShareLiveReturn {
  onClose: () => void
}

export default function ShareLiveModal({
  share,
  status,
  shareUrl,
  activate,
  deactivate,
  copyUrl,
  onClose,
}: Props) {
  const [copied, setCopied]   = useState(false)
  const overlayRef            = useRef<HTMLDivElement>(null)

  // Tutup modal kalau klik di luar
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleCopy() {
    const ok = await copyUrl()
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleToggle() {
    if (status === 'active') {
      await deactivate()
    } else {
      await activate()
    }
  }

  const isActive  = status === 'active'
  const isLoading = status === 'loading'

  return (
    <div
      className="share-modal-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Share Live Journal"
    >
      <div className="share-modal">
        {/* ── Header ── */}
        <div className="share-modal-header">
          <h2 className="share-modal-title">
            <span className={`share-status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} />
            Share Live Journal
          </h2>
          <button
            className="share-modal-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="share-modal-body">

          {/* Status badge */}
          <div className={`share-badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
            {isActive ? '● AKTIF' : '○ NONAKTIF'}
          </div>

          {/* Penjelasan singkat */}
          <p className="share-desc">
            {isActive
              ? 'Siapa saja yang punya link ini bisa melihat statistik trading kamu secara real-time.'
              : 'Aktifkan untuk membuat halaman Live publik yang bisa dibagikan.'}
          </p>

          {/* URL box — hanya tampil kalau ada token */}
          {shareUrl && (
            <div className="share-url-row">
              <input
                className="share-url-input"
                type="text"
                readOnly
                value={shareUrl}
                onFocus={e => e.target.select()}
                aria-label="Link Share Live"
              />
              <button
                className={`share-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                aria-label="Salin link"
              >
                {copied ? '✓ Tersalin' : '📋 Salin'}
              </button>
            </div>
          )}

          {/* Kalau belum pernah generate sama sekali */}
          {!shareUrl && status !== 'loading' && (
            <p className="share-empty">
              Belum ada link. Klik <strong>Aktifkan</strong> untuk generate.
            </p>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="share-modal-footer">
          <button
            className={`share-toggle-btn ${isActive ? 'btn-deactivate' : 'btn-activate'}`}
            onClick={handleToggle}
            disabled={isLoading}
          >
            {isLoading
              ? 'Memproses...'
              : isActive
                ? '🔴 Nonaktifkan'
                : '🟢 Aktifkan'}
          </button>

          <button className="share-close-btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>

      {/* ── Styles (scoped) ── */}
      <style>{`
        .share-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          animation: overlayFadeIn 0.18s ease;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .share-modal {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 12px;
          width: 100%;
          max-width: 440px;
          animation: modalSlideUp 0.2s ease;
          overflow: hidden;
        }

        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* Header */
        .share-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
        }

        .share-modal-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .share-status-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-active   { background: #22c55e; box-shadow: 0 0 6px #22c55e88; }
        .dot-inactive { background: #6b7280; }

        .share-modal-close {
          background: none;
          border: none;
          color: var(--text-secondary, #9ca3af);
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
          padding: 4px 8px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .share-modal-close:hover {
          color: var(--text-primary, #e0e0e0);
          background: rgba(255,255,255,0.07);
        }

        /* Body */
        .share-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .share-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 4px 10px;
          border-radius: 20px;
          width: fit-content;
        }
        .badge-active   { background: rgba(34,197,94,0.15);  color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .badge-inactive { background: rgba(107,114,128,0.15); color: #9ca3af; border: 1px solid rgba(107,114,128,0.25); }

        .share-desc {
          font-size: 13px;
          color: var(--text-secondary, #9ca3af);
          margin: 0;
          line-height: 1.5;
        }

        .share-url-row {
          display: flex;
          gap: 8px;
        }

        .share-url-input {
          flex: 1;
          background: var(--bg-input, rgba(255,255,255,0.05));
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 12px;
          color: var(--text-primary, #e0e0e0);
          font-family: monospace;
          min-width: 0;
          outline: none;
          transition: border-color 0.15s;
        }
        .share-url-input:focus {
          border-color: var(--accent, #6366f1);
        }

        .share-copy-btn {
          background: var(--bg-input, rgba(255,255,255,0.07));
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .share-copy-btn:hover   { background: rgba(255,255,255,0.12); }
        .share-copy-btn.copied  { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); color: #22c55e; }

        .share-empty {
          font-size: 13px;
          color: var(--text-secondary, #9ca3af);
          margin: 0;
          text-align: center;
          padding: 8px 0;
        }

        /* Footer */
        .share-modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px 18px;
          border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));
          gap: 10px;
        }

        .share-toggle-btn {
          padding: 9px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s, transform 0.1s;
        }
        .share-toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .share-toggle-btn:not(:disabled):hover { opacity: 0.88; transform: translateY(-1px); }

        .btn-activate   { background: #22c55e; color: #fff; }
        .btn-deactivate { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }

        .share-close-btn {
          background: none;
          border: 1px solid var(--border-color, rgba(255,255,255,0.12));
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 13px;
          color: var(--text-secondary, #9ca3af);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .share-close-btn:hover { background: rgba(255,255,255,0.07); color: var(--text-primary, #e0e0e0); }

        /* Tombol trigger di luar modal */
        .share-live-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-input, rgba(255,255,255,0.07));
          border: 1px solid var(--border-color, rgba(255,255,255,0.12));
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .share-live-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }

        .share-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 5px #22c55e;
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        @media (max-width: 480px) {
          .share-url-row { flex-direction: column; }
          .share-modal-footer { flex-direction: column-reverse; }
          .share-toggle-btn, .share-close-btn { width: 100%; text-align: center; }
        }
      `}</style>
    </div>
  )
}