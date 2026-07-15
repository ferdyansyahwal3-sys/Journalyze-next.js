// GrowthChart.tsx — dipindah dari admin.html renderGrowthChart() baris 869-939
'use client';

import { useChartInstance } from './useChartInstance';
import type { UserAnalytics } from '@/lib/types';

const PALETTE = ['#c9a84c', '#60a5fa', '#22c55e', '#c084fc', '#f87171'];

export default function GrowthChart({ users, days }: { users: UserAnalytics[]; days: number }) {
  const canvasRef = useChartInstance(() => {
    const today = new Date();
    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateList.push(d.toISOString().split('T')[0]);
    }
    const startDate = dateList[0];
    const topUsers = users.filter((u) => u.trades > 0).slice(0, 5);

    const datasets = topUsers.map((u, i) => {
      const dayCount: Record<string, number> = {};
      dateList.forEach((d) => (dayCount[d] = 0));
      (u.allTrades || []).filter((t) => t.tanggal >= startDate).forEach((t) => {
        if (dayCount[t.tanggal] !== undefined) dayCount[t.tanggal]++;
      });
      const baseline = (u.allTrades || []).filter((t) => t.tanggal < startDate).length;
      let cum = baseline;
      const data = dateList.map((d) => {
        cum += dayCount[d];
        return cum;
      });
      return {
        label: u.email.split('@')[0],
        data,
        borderColor: PALETTE[i],
        backgroundColor: PALETTE[i] + '22',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      };
    });

    const labels = dateList.map((d) => {
      const dt = new Date(d + 'T00:00:00');
      return days <= 90
        ? dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
        : dt.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    });
    const tickLabels =
      days > 90 ? labels.map((l, i) => (i % 14 === 0 ? l : '')) : days > 30 ? labels.map((l, i) => (i % 5 === 0 ? l : '')) : labels;

    return {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: '#C8C0B0', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 12, padding: 16 } },
          tooltip: { callbacks: { title: (t: any) => t[0].label } },
        },
        scales: {
          x: { ticks: { color: '#6A6050', font: { size: 8 }, maxRotation: 30, callback: (v: any, i: number) => tickLabels[i] }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#6A6050', font: { size: 9 }, stepSize: 1, callback: (v: any) => v + ' trade' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: false },
        },
      },
    } as any;
  }, [users, days]);

  return <canvas ref={canvasRef} />;
}
