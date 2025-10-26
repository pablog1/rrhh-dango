'use client';

import { CheckHoursResponse } from '@/lib/types';
import { useTMetricData } from '@/hooks/useTMetricData';
import AppLayout from './AppLayout';
import LoadingSpinner from './ui/LoadingSpinner';
import ErrorAlert from './ui/ErrorAlert';
import StatsCard from './ui/StatsCard';
import UserTable from './UserTable';

export default function Dashboard() {
  const { loading, data, error, fetchData } = useTMetricData<CheckHoursResponse>({
    endpoint: '/api/tmetric/check-hours',
  });

  return (
    <AppLayout>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Verificación de Horas Registradas
            </h2>
            <p className="text-gray-600 mt-1">
              Detecta empleados sin horas registradas en los últimos 2 días laborables
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingSpinner text="Verificando..." /> : 'Verificar Horas'}
          </button>
        </div>

        {error && <ErrorAlert message={error} />}

        {data?.data && (
          <>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatsCard
                label="Período Verificado"
                value={`${data.data.dateRange.from} - ${data.data.dateRange.to}`}
                variant="blue"
                size="sm"
              />
              <StatsCard
                label="Usuarios Sin Horas"
                value={data.data.usersWithoutHours.length}
                variant="red"
                size="lg"
              />
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 font-medium">Última Verificación</p>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(data.data.checkedAt).toLocaleString('es-ES')}
                </p>
              </div>
            </div>

            <UserTable
              users={data.data.usersWithoutHours}
              dateRange={data.data.dateRange}
            />
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            Haz clic en "Verificar Horas" para comenzar
          </div>
        )}
      </div>
    </AppLayout>
  );
}
