// app/home/layout.tsx
import type { Metadata } from 'next';
import './home.css';

export const metadata: Metadata = {
  title: 'Journalyze — Jurnal Trading Profesional untuk Trader Forex',
  description:
    'Catat, analisis, dan tingkatkan performa trading Forex kamu dengan Journalyze. Web app jurnal trading #1 untuk trader Indonesia. Tersedia paket lifetime mulai Rp 149.000.',
  openGraph: {
    title: 'Journalyze — Jurnal Trading Profesional',
    description:
      'Web app jurnal trading Forex profesional. Analisis win rate, RR ratio, track record, dan psikologi trading dalam satu platform.',
    url: 'https://journalyze.my.id/home',
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
  return <>{children}</>;
}