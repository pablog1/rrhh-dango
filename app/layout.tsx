import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RRHH Dango - TMetric Hours Tracker',
  description: 'Sistema de detección de horas no registradas en TMetric',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
