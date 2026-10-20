import type { Metadata } from 'next';
import {
  Cormorant_Garamond,
  Outfit,
  JetBrains_Mono,
} from 'next/font/google';
import { SITE } from '@/components/site/siteData';
import SiteLoader  from '@/components/site/SiteLoader';
import SiteNavbar  from '@/components/site/SiteNavbar';
import SiteFooter  from '@/components/site/SiteFooter';
import './site.css';
import './loader.css';

// ─── FONT (pola sama dengan (journal)/layout.tsx) ─────────────────────────
const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  weight:   ['400', '600', '700'],
  style:    ['normal', 'italic'],
  variable: '--font-cormorant',
  display:  'swap',
});

const outfit = Outfit({
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display:  'swap',
});

const jetbrains = JetBrains_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500', '700'],
  variable: '--font-jetbrains',
  display:  'swap',
});

// ─── METADATA DEFAULT ────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(`https://${SITE.url}`),
  title: {
    default:  `${SITE.name} — Jurnal Trading Forex Berbasis AI`,
    template: `%s · ${SITE.name}`,
  },
  description:
    'Journalyze adalah jurnal trading web app profesional untuk trader Forex Indonesia. Catat setiap trade, analisis performa dengan AI, dan temukan pola kemenangan yang konsisten.',
  keywords: [
    'jurnal trading', 'journal trading forex', 'trading journal indonesia',
    'kalkulator risiko forex', 'analisis trading ai', 'XAUUSD journal',
  ],
  openGraph: {
    siteName: SITE.name,
    locale:   'id_ID',
    type:     'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index:   true,
    follow:  true,
  },
};

// ─── JSON-LD Organization ────────────────────────────────────────────────────
const jsonLd = {
  '@context':   'https://schema.org',
  '@type':      'Organization',
  name:          SITE.name,
  url:          `https://${SITE.url}`,
  description:   SITE.tagline,
  contactPoint: SITE.whatsapp
    ? {
        '@type':       'ContactPoint',
        telephone:    `+${SITE.whatsapp}`,
        contactType:  'customer service',
        availableLanguage: 'Indonesian',
      }
    : undefined,
};

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${cormorant.variable} ${outfit.variable} ${jetbrains.variable}`}
      data-theme="dark"
    >
      {/* Inline script: set data-theme sebelum paint, cegah flash */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{document.querySelector('[data-theme]').setAttribute('data-theme','dark');}catch(e){}})();`,
        }}
      />

      {/* JSON-LD Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Loader — sekali per sesi, tidak muncul di route app */}
      <SiteLoader />

      {/* Navbar */}
      <SiteNavbar />

      {/* Konten halaman */}
      <main id="main-content">
        {children}
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
