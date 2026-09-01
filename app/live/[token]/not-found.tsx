// app/live/[token]/not-found.tsx
// Tampil kalau token tidak valid atau share sudah dinonaktifkan

export default function LiveNotFound() {
  return (
    <div className="live-notfound">
      <div className="live-notfound-icon">📡</div>
      <h1 className="live-notfound-title">Link Tidak Valid</h1>
      <p className="live-notfound-desc">
        Halaman live ini tidak ditemukan atau sudah dinonaktifkan oleh pemiliknya.
      </p>

      <style>{`
        .live-notfound {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: var(--bg-main, #0f0f1a);
          padding: 24px;
          text-align: center;
        }
        .live-notfound-icon  { font-size: 56px; }
        .live-notfound-title { font-size: 22px; font-weight: 700; color: var(--text-primary, #e0e0e0); margin: 0; }
        .live-notfound-desc  { font-size: 14px; color: var(--text-secondary, #9ca3af); margin: 0; max-width: 320px; line-height: 1.6; }
      `}</style>
    </div>
  )
}