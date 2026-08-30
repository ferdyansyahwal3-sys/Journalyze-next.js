'use client'

// components/journal/PagePlaceholder.tsx
// Placeholder SEMENTARA untuk konten 7 halaman (home/risk/plan/data/filter/
// weekly/monthly/news) — isinya menyusul Phase 4+ sesuai roadmap. Wrapper
// class="page" + toggle "active" di sini SUDAH final (dipakai permanen),
// cuma isi di dalamnya yang bakal diganti komponen sungguhan nanti.
export default function PagePlaceholder({
  id,
  title,
  active,
}: {
  id: string;
  title: string;
  active: boolean;
}) {
  return (
    <div className={`page ${active ? 'active' : ''}`} id={`page-${id}`}>
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}>
          Halaman &quot;{title}&quot; — menyusul di Phase berikutnya
        </div>
      </div>
    </div>
  );
}