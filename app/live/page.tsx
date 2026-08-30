// app/live/page.tsx
import dynamic from 'next/dynamic';

const LiveApp = dynamic(() => import('@/components/live/LiveApp'), {
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

export default function Page() {
  return <LiveApp />;
}
