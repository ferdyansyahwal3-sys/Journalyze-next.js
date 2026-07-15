// app/layout.tsx — root layout (WAJIB ada, satu-satunya tempat <html>/<body>)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Journalyze',
  description: 'Jurnal trading profesional dengan analisis AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
