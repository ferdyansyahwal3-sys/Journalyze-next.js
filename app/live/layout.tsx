/**
 * app/live/layout.tsx
 * Phase 10 — Layout untuk route /live
 *
 * - Import live.css (verbatim dari live.html)
 * - Google Fonts: Outfit, Cormorant Garamond, JetBrains Mono
 *   (sama persis dengan index.html)
 * - Default theme: dark (sesuai live.html)
 * - Public route — tidak ada auth check
 */

import type { Metadata } from 'next';
import './live.css';

export const metadata: Metadata = {
  title: 'Live Journal — Journalyze',
  description: 'Lihat trading journal secara real-time. Public read-only view.',
  robots: { index: false, follow: false },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Google Fonts — sama dengan yang ada di live.html <head>
        Pakai next/font atau <link> langsung — di sini pakai <link>
        supaya verbatim sama dengan source HTML.
      */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {/* Set default theme di <html> — client component akan override jika user switch */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var t = localStorage.getItem('jz-theme') || 'dark';
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