'use client';

import { GetChartsResponse, UserChartData } from '@/lib/types';
import { useTMetricData } from '@/hooks/useTMetricData';
import AppLayout from './AppLayout';
import LoadingSpinner from './ui/LoadingSpinner';
import ErrorAlert from './ui/ErrorAlert';
import StatsCard from './ui/StatsCard';
import UserChart from './UserChart';

export default function ChartsView() {
  const { loading, data, error, fetchData } = useTMetricData<GetChartsResponse>({
    endpoint: '/api/tmetric/charts',
  });

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
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                label="Total de Usuarios"
                value={data.data.totalUsers}
                variant="green"
                size="lg"
              />
            </div>

            <div className="space-y-6">
              {data.data.users.map((user: UserChartData) => (
                <div key={user.id} className="bg-gray-50 rounded-lg p-6">
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
