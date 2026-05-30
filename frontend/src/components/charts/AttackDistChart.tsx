import { useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';
import type { AttackDistPoint } from '../../types/index.js';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const COLORS = [
  '#EF4444','#F59E0B','#2563EB','#8B5CF6',
  '#EC4899','#22C55E','#F97316','#06B6D4',
];

const FONT = { family: 'DM Sans, sans-serif', size: 11 };

export function AttackDistChart({ data = [] }: { data?: AttackDistPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // In React Strict Mode or HMR, we must ensure any existing chart on this canvas is destroyed
    const existingChart = Chart.getChart(canvasRef.current);
    if (existingChart) existingChart.destroy();
    
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels:   data.map(d => d.type),
        datasets: [{
          data:            data.map(d => d.count),
          backgroundColor: COLORS.slice(0, data.length),
          borderWidth:     0,
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '68%',
        plugins: {
          legend: {
            position: 'right',
            labels:   { font: FONT, boxWidth: 10, padding: 10 },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  return <canvas ref={canvasRef} style={{ height: 200 }} />;
}
