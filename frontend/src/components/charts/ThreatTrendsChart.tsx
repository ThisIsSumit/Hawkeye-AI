import { useEffect, useRef } from 'react';
import {
  Chart, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, Filler,
  ArcElement, LineController, DoughnutController
} from 'chart.js';
import type { TrendPoint, AttackDistPoint } from '../../types/index.js';

Chart.register(
  LineController, DoughnutController, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, Filler, ArcElement,
);

const FONT = { family: 'DM Sans, sans-serif', size: 11 };

// ─── Threat Trends Line Chart ─────────────────────────────────────────────────

export function ThreatTrendsChart({ data = [] }: { data?: TrendPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // React Strict Mode / HMR: destroy any orphaned chart attached to this canvas DOM
    const existingChart = Chart.getChart(canvasRef.current);
    if (existingChart) existingChart.destroy();

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            label: 'Critical',
            data:  data.map(d => d.critical),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239,68,68,.07)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#EF4444',
          },
          {
            label: 'High',
            data:  data.map(d => d.high),
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,.05)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#F59E0B',
          },
          {
            label: 'Medium',
            data:  data.map(d => d.medium),
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37,99,235,.04)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#2563EB',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { font: FONT, boxWidth: 10, padding: 16 },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: FONT } },
          y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: FONT } },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  return <canvas ref={canvasRef} style={{ height: 200 }} />;
}

// ─── Attack Distribution Doughnut ─────────────────────────────────────────────

const COLORS = ['#EF4444','#F59E0B','#2563EB','#8B5CF6','#EC4899','#22C55E','#F97316','#06B6D4'];

export function AttackDistChart({ data }: { data: AttackDistPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

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
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: { font: FONT, boxWidth: 10, padding: 12 },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  return <canvas ref={canvasRef} style={{ height: 200 }} />;
}
