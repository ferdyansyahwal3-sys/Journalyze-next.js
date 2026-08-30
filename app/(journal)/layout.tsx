// app/(journal)/layout.tsx
import type { Metadata } from 'next';
import { Cormorant_Garamond, Outfit, JetBrains_Mono } from 'next/font/google';
import './home.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Journalyze — Jurnal Trading Profesional untuk Trader Forex',
  description:
    'Catat, analisis, dan tingkatkan performa trading Forex kamu dengan Journalyze. Web app jurnal trading #1 untuk trader Indonesia. Tersedia paket lifetime mulai Rp 149.000.',
  openGraph: {
    title: 'Journalyze — Jurnal Trading Profesional',
    description:
      'Web app jurnal trading Forex profesional. Analisis win rate, RR ratio, track record, dan psikologi trading dalam satu platform.',
    url: 'https://journalyze.my.id',
    siteName: 'Journalyze',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Journalyze — Jurnal Trading Profesional',
    description: 'Platform jurnal trading Forex untuk trader Indonesia.',
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cormorant.variable} ${outfit.variable} ${jetbrains.variable}`}>
      {children}
    </div>
  );
}
