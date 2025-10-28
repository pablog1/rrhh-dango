'use client';

import { useState } from 'react';
import { GetChartsResponse, UserChartData } from '@/lib/types';
import { useTMetricData } from '@/hooks/useTMetricData';
import AppLayout from './AppLayout';
import LoadingSpinner from './ui/LoadingSpinner';
import ErrorAlert from './ui/ErrorAlert';
import StatsCard from './ui/StatsCard';
import UserChart from './UserChart';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ChartsView() {
  const { loading, data, error, fetchData } = useTMetricData<GetChartsResponse>({
    endpoint: '/api/tmetric/charts',
  });
  const [exportingPDF, setExportingPDF] = useState(false);

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
      pdf.text('Gráficos de Horas Trabajadas', margin, yPosition);
      yPosition += 8;

      // Add date range
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Período: ${data.data.dateRange.from} - ${data.data.dateRange.to}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total de Usuarios: ${data.data.totalUsers}`, margin, yPosition);
      yPosition += 10;

      // Process each user chart
      for (let i = 0; i < data.data.users.length; i++) {
        const user = data.data.users[i];
        const chartElement = document.getElementById(`user-chart-${i}`);

        if (chartElement) {
          // Capture chart as image
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            logging: false,
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Check if we need a new page
          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          // Add user name
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(user.name, margin, yPosition);
          yPosition += 6;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`Total últimos 30 días: ${user.totalHoursLast30Days}`, margin, yPosition);
          yPosition += 8;

          // Add chart image
          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        }
      }

      // Save PDF
      const fileName = `graficos-horas-${data.data.dateRange.from}-${data.data.dateRange.to}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Por favor intenta de nuevo.');
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
              Gráficos de Horas Trabajadas
            </h2>
            <p className="text-gray-600 mt-1">
              Visualiza las horas trabajadas de todos los usuarios en los últimos 30 días
            </p>
          </div>
          <div className="flex gap-3">
            {data?.data && (
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {exportingPDF ? <LoadingSpinner text="Generando PDF..." /> : 'Exportar PDF'}
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                label="Total de Usuarios"
                value={data.data.totalUsers}
                variant="green"
                size="lg"
              />
            </div>

            <div className="space-y-6">
              {data.data.users.map((user: UserChartData, index: number) => (
                <div key={user.id} id={`user-chart-${index}`} className="bg-gray-50 rounded-lg p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">
                      Total últimos 30 días: <span className="font-medium">{user.totalHoursLast30Days}</span>
                    </p>
                  </div>
                  {user.dailyHours && user.dailyHours.length > 0 ? (
                    <UserChart userName={user.name} dailyHours={user.dailyHours} />
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No hay datos de horas para este usuario en los últimos 30 días
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
