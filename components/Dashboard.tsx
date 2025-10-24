'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { CheckHoursResponse } from '@/lib/types';
import UserTable from './UserTable';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CheckHoursResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckHours = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tmetric/check-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: CheckHoursResponse = await response.json();

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      setError('Error al conectarse con el servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">RRHH Dango</h1>
              <span className="ml-4 text-sm text-gray-500">TMetric Hours Tracker</span>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
                onClick={handleCheckHours}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  'Verificar Horas'
                )}
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {data?.data && (
              <>
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium">Período Verificado</p>
                    <p className="mt-1 text-lg font-semibold text-blue-900">
                      {data.data.dateRange.from} - {data.data.dateRange.to}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-red-600 font-medium">Usuarios Sin Horas</p>
                    <p className="mt-1 text-3xl font-bold text-red-900">
                      {data.data.usersWithoutHours.length}
                    </p>
                  </div>
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
        </div>
      </main>
    </div>
  );
}
