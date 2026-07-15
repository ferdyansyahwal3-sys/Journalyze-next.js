// app/admin/layout.tsx
// Layout khusus route /admin — hanya di-load saat user membuka /admin,
// supaya CSS admin.css tidak "bocor" ke halaman lain di masa depan.
import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: 'Journalyze — Admin Panel',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Catatan: <html>/<body> HANYA boleh dideklarasikan di root layout
  // (app/layout.tsx). <link> di sini otomatis di-hoist Next.js App Router
  // ke <head> dokumen — behaviornya sama seperti <link> manual di admin.html.
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
