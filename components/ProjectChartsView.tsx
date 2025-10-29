'use client';

import { useState, useMemo } from 'react';
import { GetProjectChartsResponse, ProjectChartData } from '@/lib/types';
import { useTMetricData } from '@/hooks/useTMetricData';
import AppLayout from './AppLayout';
import LoadingSpinner from './ui/LoadingSpinner';
import ErrorAlert from './ui/ErrorAlert';
import StatsCard from './ui/StatsCard';
import ProjectChart from './ProjectChart';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ProjectChartsView() {
  const [days, setDays] = useState<30 | 60>(30);
  const { loading, data, error, fetchData, setData, setError } = useTMetricData<GetProjectChartsResponse>({
    endpoint: '/api/tmetric/project-charts',
    params: { days },
  });
  const [exportingPDF, setExportingPDF] = useState(false);

  // Calculate total hours across all projects
  const totalData = useMemo(() => {
    if (!data?.data?.projects || data.data.projects.length === 0) return null;

    const dailyTotals = new Map<string, number>();
    let totalMinutes = 0;

    // Sum hours for each date across all projects
    data.data.projects.forEach((project) => {
      project.dailyHours.forEach((day) => {
        const current = dailyTotals.get(day.date) || 0;
        dailyTotals.set(day.date, current + day.hours);

        // Calculate total minutes
        totalMinutes += day.hours * 60;
      });
    });

    // Convert map to array and sort by date
    const dailyHours = Array.from(dailyTotals.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('/').map(Number);
        const [dayB, monthB, yearB] = b.date.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      });

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = Math.floor(totalMinutes % 60);

    return {
      dailyHours,
      totalHoursLast30Days: `${totalHours} h ${totalMins} min`,
    };
  }, [data]);

  const handleDaysChange = (newDays: 30 | 60) => {
    setDays(newDays);
    // Clear current data when changing days
    setData(null);
    setError(null);
  };

  const handleExportPDF = async () => {
    if (!data?.data) return;

    setExportingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Add title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Gráficos de Horas por Proyecto', margin, yPosition);
      yPosition += 8;

      // Add date range
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Período: ${data.data.dateRange.from} - ${data.data.dateRange.to}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total de Proyectos: ${data.data.totalProjects}`, margin, yPosition);
      yPosition += 10;

      // Add total chart if exists
      if (totalData) {
        const totalChartElement = document.getElementById(`project-chart-total`);
        if (totalChartElement) {
          const canvas = await html2canvas(totalChartElement, {
            scale: 2,
            logging: false,
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('TOTAL - Todos los Proyectos', margin, yPosition);
          yPosition += 6;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`Total últimos ${days} días: ${totalData.totalHoursLast30Days}`, margin, yPosition);
          yPosition += 8;

          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        }
      }

      // Process each project chart
      for (let i = 0; i < data.data.projects.length; i++) {
        const project = data.data.projects[i];
        const chartElement = document.getElementById(`project-chart-${i}`);

        if (chartElement) {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            logging: false,
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(project.name, margin, yPosition);
          yPosition += 6;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          if (project.client) {
            pdf.text(`Cliente: ${project.client}`, margin, yPosition);
            yPosition += 4;
          }
          pdf.text(`Total últimos ${days} días: ${project.totalHoursLast30Days}`, margin, yPosition);
          yPosition += 8;

          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        }
      }

      pdf.save(`proyectos-${data.data.dateRange.from}-${data.data.dateRange.to}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Por favor intenta nuevamente.');
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <AppLayout>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Gráficos de Horas por Proyecto
            </h2>
            <p className="text-gray-600 mt-1">
              Visualiza las horas trabajadas en cada proyecto activo de los últimos {days} días
            </p>
          </div>
          <div className="flex gap-3">
            {/* Day selector */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => handleDaysChange(30)}
                className={`px-4 py-2 font-medium transition-colors ${
                  days === 30
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                30 días
              </button>
              <button
                onClick={() => handleDaysChange(60)}
                className={`px-4 py-2 font-medium transition-colors ${
                  days === 60
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                60 días
              </button>
            </div>
            {data?.data && (
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {exportingPDF ? <LoadingSpinner text="Generando PDF..." /> : 'Descargar PDF'}
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner text="Cargando..." /> : 'Cargar Gráficos'}
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} />}

        {data?.data && (
          <>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatsCard
                label="Período"
                value={`${data.data.dateRange.from} - ${data.data.dateRange.to}`}
                variant="blue"
                size="sm"
              />
              <StatsCard
                label="Total de Proyectos Activos"
                value={data.data.totalProjects}
                variant="green"
                size="lg"
              />
            </div>

            <div className="space-y-6">
              {/* Total Chart */}
              {totalData && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border-2 border-indigo-200">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-indigo-900">TOTAL - Todos los Proyectos</h3>
                    <p className="text-sm text-indigo-700 mt-1">
                      Total últimos {days} días: <span className="font-bold text-lg">{totalData.totalHoursLast30Days}</span>
                    </p>
                  </div>
                  <div id="project-chart-total">
                    <ProjectChart
                      projectName="Total"
                      dailyHours={totalData.dailyHours}
                      color="rgb(99, 102, 241)"
                    />
                  </div>
                </div>
              )}

              {/* Individual Project Charts */}
              {data.data.projects.map((project: ProjectChartData, index: number) => (
                <div key={project.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    {project.client && (
                      <p className="text-sm text-gray-500">Cliente: {project.client}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      Total últimos {days} días: <span className="font-medium">{project.totalHoursLast30Days}</span>
                    </p>
                  </div>
                  {project.dailyHours && project.dailyHours.length > 0 ? (
                    <div id={`project-chart-${index}`}>
                      <ProjectChart projectName={project.name} dailyHours={project.dailyHours} />
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No hay datos de horas para este proyecto en los últimos {days} días
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            Haz clic en "Cargar Gráficos" para comenzar
          </div>
        )}
      </div>
    </AppLayout>
  );
}
