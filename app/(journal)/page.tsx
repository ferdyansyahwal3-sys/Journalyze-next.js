// app/(journal)/page.tsx
import dynamic from 'next/dynamic';

const HomeApp = dynamic(() => import('@/components/home/HomeApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#080808'
    }}>
      <div style={{
        color: '#C9A84C',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        letterSpacing: 2
      }}>
        Loading...
      </div>
    </div>
  ),
});

export default function HomPage() {
  return <HomeApp />;
}
