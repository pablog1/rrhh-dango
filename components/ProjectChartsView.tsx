'use client';

import { GetProjectChartsResponse, ProjectChartData } from '@/lib/types';
import { useTMetricData } from '@/hooks/useTMetricData';
import AppLayout from './AppLayout';
import LoadingSpinner from './ui/LoadingSpinner';
import ErrorAlert from './ui/ErrorAlert';
import StatsCard from './ui/StatsCard';
import ProjectChart from './ProjectChart';

export default function ProjectChartsView() {
  const { loading, data, error, fetchData } = useTMetricData<GetProjectChartsResponse>({
    endpoint: '/api/tmetric/project-charts',
  });

  return (
    <AppLayout>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Gráficos de Horas por Proyecto
            </h2>
            <p className="text-gray-600 mt-1">
              Visualiza las horas trabajadas en cada proyecto activo de los últimos 30 días
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingSpinner text="Cargando..." /> : 'Cargar Gráficos'}
          </button>
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
              {data.data.projects.map((project: ProjectChartData) => (
                <div key={project.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    {project.client && (
                      <p className="text-sm text-gray-500">Cliente: {project.client}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      Total últimos 30 días: <span className="font-medium">{project.totalHoursLast30Days}</span>
                    </p>
                  </div>
                  {project.dailyHours && project.dailyHours.length > 0 ? (
                    <ProjectChart projectName={project.name} dailyHours={project.dailyHours} />
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No hay datos de horas para este proyecto en los últimos 30 días
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
