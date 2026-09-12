'use client'
// components/journal/ShareLiveModal.tsx — REDESIGN: design system journal
// Pakai CSS vars + class identik dengan modal-modal lain di journal

import { useState, useEffect, useRef } from 'react'
import type { UseShareLiveReturn } from '@/hooks/useShareLive'

interface Props extends UseShareLiveReturn {
  onClose: () => void
}

export default function ShareLiveModal({
  share, status, shareUrl,
  activate, deactivate, copyUrl, onClose,
}: Props) {
  const [copied, setCopied] = useState(false)
  const overlayRef          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleCopy() {
    const ok = await copyUrl()
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  async function handleToggle() {
    if (status === 'active') await deactivate()
    else await activate()
  }

  const isActive  = status === 'active'
  const isLoading = status === 'loading'

  return (
    <>
      {/* Overlay */}
      <div
        className="slm-overlay"
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose() }}
        role="dialog"
        aria-modal="true"
        aria-label="Share Live Journal"
      >
        <div className="slm-modal">

          {/* ── Header ── */}
          <div className="slm-header">
            <div>
              <div className="ph-label" style={{ marginBottom: 4 }}>Journalyze</div>
              <h2 className="slm-title">
                Share <em>Live Journal</em>
              </h2>
            </div>
            <button className="slm-close btn btn-ghost btn-sm" onClick={onClose} aria-label="Tutup">
              ✕
            </button>
          </div>

          {/* ── Body ── */}
          <div className="slm-body">

            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`rbadge ${isActive ? 'cons' : 'mod'}`}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isActive ? 'var(--green)' : 'var(--gold)',
                  boxShadow: isActive ? '0 0 6px var(--green)' : 'none',
                  animation: isActive ? 'pulse 1.5s infinite' : 'none',
                  display: 'inline-block',
                }} />
                {isActive ? 'Aktif' : 'Nonaktif'}
              </span>
              {isActive && (
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  letterSpacing: 1,
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                }}>
                  Publik · Real-time
                </span>
              )}
            </div>

            {/* Desc */}
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>
              {isActive
                ? 'Siapa saja yang punya link ini dapat melihat statistik trading kamu secara real-time — tanpa perlu login.'
                : 'Aktifkan untuk generate link publik. Visitor hanya bisa melihat, tidak bisa edit data apapun.'}
            </p>

            {/* URL box */}
            {shareUrl && (
              <div className="slm-url-row">
                <div className="fwrap" style={{ flex: 1 }}>
                  <input
                    className="finput"
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, paddingRight: 8 }}
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={e => e.target.select()}
                    aria-label="Link Share Live"
                  />
                </div>
                <button
                  className={`btn ${copied ? 'btn-ghost' : 'btn-gold'} btn-sm`}
                  style={copied ? { borderColor: 'var(--green-bd)', color: 'var(--green)' } : {}}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Tersalin' : '📋 Salin'}
                </button>
              </div>
            )}

            {/* Empty state */}
            {!shareUrl && !isLoading && (
              <div style={{
                textAlign: 'center', padding: '16px 0',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11, color: 'var(--text3)',
              }}>
                Belum ada link — klik <strong style={{ color: 'var(--gold2)' }}>Aktifkan</strong> untuk generate.
              </div>
            )}

            {/* Info note */}
            <div style={{
              background: 'var(--gold-bg)',
              border: '1px solid var(--gold-bd)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>◆</span>
              <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                Halaman Live menampilkan statistik publik — Total Trade, PnL, Win Rate, Equity Curve, dan 20 trade terakhir.
                Nonaktifkan kapan saja untuk mencabut akses.
              </p>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="slm-footer">
            <button
              className={`btn ${isActive ? 'btn-danger' : 'btn-gold'}`}
              onClick={handleToggle}
              disabled={isLoading}
            >
              {isLoading
                ? '⏳ Memproses...'
                : isActive
                  ? '🔴 Nonaktifkan'
                  : '🟢 Aktifkan'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Tutup
            </button>
          </div>

        </div>
      </div>

      <style>{`
        .slm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          animation: slm-in .18s ease;
        }
        @keyframes slm-in { from { opacity: 0; } to { opacity: 1; } }

        .slm-modal {
          background: var(--bg2);
          border: 1px solid var(--gold-bd);
          border-radius: 14px;
          width: 100%;
          max-width: 460px;
          box-shadow: var(--shadow);
          animation: slm-up .22s cubic-bezier(.33,1,.68,1);
          overflow: hidden;
        }
        @keyframes slm-up {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* Header */
        .slm-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--gold-bg);
        }
        .slm-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          line-height: 1.1;
        }
        .slm-title em {
          font-style: italic;
          color: var(--gold3);
        }
        .slm-close {
          margin-top: 2px;
          flex-shrink: 0;
        }

        /* Body */
        .slm-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* URL row */
        .slm-url-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        /* Footer */
        .slm-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px 18px;
          border-top: 1px solid var(--border);
          gap: 10px;
        }

        @media (max-width: 480px) {
          .slm-url-row { flex-direction: column; }
          .slm-footer  { flex-direction: column-reverse; }
          .slm-footer .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </>
  )
}