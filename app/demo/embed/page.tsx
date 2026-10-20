// app/demo/embed/page.tsx
// Route khusus untuk di-iframe di landing page.
// Tanpa DemoBanner, tanpa DemoBotNav — bersih, hanya app journal.
// Menerima postMessage { page: string } dari parent untuk switch tab.

import dynamic from 'next/dynamic';

const DemoEmbedApp = dynamic(() => import('@/components/demo/DemoEmbedApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#080808',
    }}>
      <div style={{
        color: '#C9A84C',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        letterSpacing: 2,
      }}>
        Loading...
      </div>
    </div>
  ),
});

export default function DemoEmbedPage() {
  return <DemoEmbedApp />;
}
