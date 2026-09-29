// app/journal/layout.tsx
import type { Metadata } from 'next';
import { Cormorant_Garamond, Outfit, JetBrains_Mono } from 'next/font/google';
import './journal.css';
import './gallery.css';

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
  title: 'Journalyze — Trading Suite',
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cormorant.variable} ${outfit.variable} ${jetbrains.variable}`}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@300;400;500;600;700;800&display=swap"
      />
      {children}
    </div>
  );
}
