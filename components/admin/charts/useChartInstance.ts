// useChartInstance.ts
// Pengganti pola destroyChart(id) + _analyticsCharts[id] = new Chart(...)
// di admin.html. Setiap chart komponen pakai hook ini supaya instance lama
// selalu di-destroy sebelum re-render — sama seperti perilaku aslinya.
'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export function useChartInstance(
  buildConfig: () => Chart['config'] | null,
  deps: React.DependencyList
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const config = buildConfig();
    if (config && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) chartRef.current = new Chart(ctx, config as any);
    }
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return canvasRef;
}
