// PairsChart.tsx — dipindah dari admin.html renderPairsChart() baris 816-831
'use client';

import { useChartInstance } from './useChartInstance';
import type { Trade } from '@/lib/types';

const PALETTE = [
  'rgba(201,168,76,0.8)', 'rgba(96,165,250,0.8)', 'rgba(34,197,94,0.8)', 'rgba(232,64,64,0.8)',
  'rgba(192,132,252,0.8)', 'rgba(251,191,36,0.8)', 'rgba(52,211,153,0.8)', 'rgba(248,113,113,0.8)',
];

export default function PairsChart({ trades }: { trades: Trade[] }) {
  const canvasRef = useChartInstance(() => {
    const pairCount: Record<string, number> = {};
    trades.forEach((t) => {
      if (t.pair) pairCount[t.pair] = (pairCount[t.pair] || 0) + 1;
    });
    const sorted = Object.entries(pairCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!sorted.length) return null;

    return {
      type: 'doughnut',
      data: {
        labels: sorted.map((s) => s[0]),
        datasets: [{ data: sorted.map((s) => s[1]), backgroundColor: PALETTE, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#C8C0B0', font: { size: 10 }, boxWidth: 12, padding: 10 } } },
      },
    } as any;
  }, [trades]);

  return <canvas ref={canvasRef} />;
}
