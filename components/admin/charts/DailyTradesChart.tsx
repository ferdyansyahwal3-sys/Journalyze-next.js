// DailyTradesChart.tsx — dipindah dari admin.html renderDailyTradesChart() baris 771-795
'use client';

import { useChartInstance } from './useChartInstance';
import type { Trade } from '@/lib/types';

export default function DailyTradesChart({ trades }: { trades: Trade[] }) {
  const canvasRef = useChartInstance(() => {
    const today = new Date();
    const days: string[] = [];
    const counts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push(key);
      counts[key] = 0;
    }
    trades.forEach((t) => {
      if (t.tanggal && counts[t.tanggal] !== undefined) counts[t.tanggal]++;
    });
    const labels = days.map((d) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });
    const data = days.map((d) => counts[d]);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Jumlah Trade',
            data,
            backgroundColor: 'rgba(201,168,76,0.5)',
            borderColor: 'rgba(201,168,76,0.9)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6A6050', font: { size: 8 }, maxRotation: 45, maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#6A6050', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    } as any;
  }, [trades]);

  return <canvas ref={canvasRef} />;
}
