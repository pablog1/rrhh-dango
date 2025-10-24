import { UserWithoutHours } from '@/lib/types';

interface UserTableProps {
  users: UserWithoutHours[];
  dateRange: { from: string; to: string };
}

export default function UserTable({ users, dateRange }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Todos los empleados registraron horas
        </h3>
        <p className="text-gray-600">
          No hay usuarios sin horas registradas en el período {dateRange.from} - {dateRange.to}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Último Registro
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Días Sin Registros
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Horas Últimos 30 Días
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <span className="mr-1">●</span>
                  Sin horas
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {user.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.lastEntry ? (
                  <span>{user.lastEntry}</span>
                ) : (
                  <span className="text-gray-400">Sin registros</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.daysWithoutEntries !== undefined ? (
                  <span className={user.daysWithoutEntries > 7 ? 'text-red-600 font-semibold' : ''}>
                    {user.daysWithoutEntries} días
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.totalHoursLast30Days || '0 h 0 min'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
