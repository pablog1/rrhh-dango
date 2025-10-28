'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-gray-900">RRHH Dango</h1>
            <div className="flex space-x-4">
              <Link
                href="/"
                className={`text-sm font-medium ${
                  isActive('/')
                    ? 'text-blue-600 hover:text-blue-800'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Verificar Horas
              </Link>
              <Link
                href="/charts"
                className={`text-sm font-medium ${
                  isActive('/charts')
                    ? 'text-blue-600 hover:text-blue-800'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Gráficos Usuarios
              </Link>
              <Link
                href="/project-charts"
                className={`text-sm font-medium ${
                  isActive('/project-charts')
                    ? 'text-green-600 hover:text-green-800'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Gráficos Proyectos
              </Link>
            </div>
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
  );
}
