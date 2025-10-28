'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { DailyHours } from '@/lib/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ProjectChartProps {
  projectName: string;
  dailyHours: DailyHours[];
}

export default function ProjectChart({ projectName, dailyHours }: ProjectChartProps) {
  // Sort daily hours by date (oldest to newest) and format labels
  const sortedData = [...dailyHours]
    .map(item => {
      // Extract date from format "DD/MM/YYYY Day" (e.g., "29/09/2025 Monday")
      // Remove any extra whitespace and day name
      const dateOnly = item.date.split(/\s+/)[0].trim();
      const [day, month, year] = dateOnly.split('/').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

      return {
        ...item,
        dateOnly,
        dateObj,
        dayOfWeek,
        // Format as "DD/MM" for display
        label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
        // Get day name in Spanish
        dayName: dateObj.toLocaleDateString('es-ES', { weekday: 'short' }),
      };
    })
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Plugin to draw weekend backgrounds
  const weekendBackgroundPlugin = {
    id: 'weekendBackground',
    beforeDraw: (chart: any) => {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      const meta = chart.getDatasetMeta(0);

      ctx.save();

      // Calculate width between data points
      let width = 20; // Default width
      if (meta.data.length > 1) {
        const x1 = meta.data[0].x;
        const x2 = meta.data[1].x;
        width = Math.abs(x2 - x1);
      }

      sortedData.forEach((item, index) => {
        // Check if it's Saturday (6) or Sunday (0)
        if (item.dayOfWeek === 0 || item.dayOfWeek === 6) {
          const point = meta.data[index];
          if (point) {
            const x = point.x;

            ctx.fillStyle = 'rgba(200, 200, 200, 0.15)'; // More visible gray background
            ctx.fillRect(
              x - width / 2,
              chartArea.top,
              width,
              chartArea.bottom - chartArea.top
            );
          }
        }
      });

      ctx.restore();
    }
  };

  const data = {
    labels: sortedData.map(item => `${item.label}\n${item.dayName}`),
    datasets: [
      {
        label: 'Hours Worked',
        data: sortedData.map(item => item.hours),
        borderColor: 'rgb(16, 185, 129)', // Green color for projects
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `${projectName} - Últimos 30 Días`,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const hours = context.parsed.y ?? 0;
            const fullHours = Math.floor(hours);
            const minutes = Math.round((hours - fullHours) * 60);
            return `${fullHours}h ${minutes}min`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Fecha',
          font: {
            weight: 'bold',
          },
        },
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
          font: {
            size: 11,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Horas',
          font: {
            weight: 'bold',
          },
        },
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + 'h';
          },
        },
      },
    },
  };

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <Line data={data} options={options} plugins={[weekendBackgroundPlugin]} />
    </div>
  );
}
