// WinRateChart.tsx — dipindah dari admin.html renderWinRateChart() baris 797-814
'use client';

import { useChartInstance } from './useChartInstance';
import type { UserAnalytics } from '@/lib/types';

export default function WinRateChart({ users }: { users: UserAnalytics[] }) {
  const canvasRef = useChartInstance(() => {
    const top = users.filter((u) => u.trades >= 3).slice(0, 10);
    if (!top.length) return null;
    const labels = top.map((u) => u.email.split('@')[0]);
    const data = top.map((u) => u.wr);
    const colors = data.map((v) => (v >= 50 ? 'rgba(34,197,94,0.7)' : 'rgba(232,64,64,0.7)'));

    return {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Win Rate %', data, backgroundColor: colors, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6A6050', font: { size: 8 }, maxRotation: 30 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#6A6050', font: { size: 9 }, callback: (v: any) => v + '%' }, grid: { color: 'rgba(255,255,255,0.04)' }, max: 100 },
        },
      },
    } as any;
  }, [users]);

  return <canvas ref={canvasRef} />;
}
