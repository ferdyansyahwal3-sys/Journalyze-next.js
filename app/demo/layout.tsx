/**
 * app/demo/layout.tsx
 * Pakai CSS yang sama persis dengan journal
 */
import type { Metadata } from 'next';
import '../(journal)/journal.css';

export const metadata: Metadata = {
  title: 'Journalyze — Coba Gratis',
  description: 'Coba fitur Journalyze tanpa daftar. Data tersimpan di browser kamu.',
  robots: { index: true, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var t = localStorage.getItem('jz_theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            })();
          `,
        }}
      />
      {children}
    </>
  );
}