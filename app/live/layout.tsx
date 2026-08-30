/**
 * app/live/layout.tsx
 * Phase 10 — Layout untuk route /live
 */
import type { Metadata } from 'next';
import { Cormorant_Garamond, Outfit, JetBrains_Mono } from 'next/font/google';
import './live.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Live Journal — Journalyze',
  description: 'Lihat trading journal secara real-time. Public read-only view.',
  robots: { index: false, follow: false },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cormorant.variable} ${outfit.variable} ${jetbrains.variable}`}>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('jz-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
        }}
      />
      {children}
    </div>
  );
}
