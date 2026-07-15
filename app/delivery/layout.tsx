// app/delivery/layout.tsx
import type { Metadata } from 'next';
import './delivery.css';

export const metadata: Metadata = {
  title: 'Journalyze — Akses Produk Kamu 🎉',
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
