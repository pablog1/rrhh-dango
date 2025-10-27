# RRHH Dango - TMetric Hours Tracker

Sistema web para detectar empleados de RRHH que no han registrado horas en TMetric durante los últimos 2 días laborables (excluyendo fines de semana).

## Características

- ✅ Autenticación simple con NextAuth.js
- ✅ Automatización de navegador con Playwright para conectarse a TMetric
- ✅ Detección automática de días laborables (excluye sábados y domingos)
- ✅ Dashboard con tabla de usuarios sin horas registradas
- ✅ Interfaz moderna con Next.js 15 y Tailwind CSS
- ✅ Protección de rutas con middleware de autenticación

## Tecnologías

- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Autenticación**: NextAuth.js v4
- **Automatización Web**: Playwright
- **Estilos**: Tailwind CSS
- **Utilidades de Fecha**: date-fns

## Requisitos Previos

- Node.js 18+ instalado
- npm o yarn
- Cuenta de TMetric con credenciales válidas

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/pablog1/rrhh-dango.git
cd rrhh-dango
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Instalar navegadores de Playwright

```bash
npx playwright install chromium
```

### 4. Configurar variables de entorno

Copia el archivo de ejemplo y edita con tus credenciales:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=genera-un-secret-random-aqui
NEXTAUTH_URL=http://localhost:3000

# Sistema - Credenciales de Admin
ADMIN_EMAIL=tu-email@example.com
ADMIN_PASSWORD=tu-password-seguro

# TMetric - Credenciales para scraping
TMETRIC_EMAIL=tu-email-tmetric@empresa.com
TMETRIC_PASSWORD=tu-password-tmetric
```

**Generar NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Uso

### 1. Iniciar Sesión

- Accede a `http://localhost:3000`
- Serás redirigido a `/login`
- Ingresa el email y password configurados en `ADMIN_EMAIL` y `ADMIN_PASSWORD`

### 2. Verificar Horas

- Una vez autenticado, verás el dashboard
- Haz clic en el botón **"Verificar Horas"**
- El sistema:
  1. Calculará los últimos 2 días laborables
  2. Se conectará a TMetric mediante Playwright
  3. Extraerá datos de usuarios y time entries
  4. Mostrará la tabla con usuarios sin horas registradas

**Nota**: El proceso puede tomar 30-90 segundos dependiendo de la cantidad de usuarios.

### 3. Interpretar Resultados

El dashboard mostrará:

- **Período Verificado**: Rango de fechas analizado
- **Usuarios Sin Horas**: Cantidad de empleados sin registros
- **Última Verificación**: Timestamp de la última consulta
- **Tabla**: Lista detallada de usuarios con estado, nombre, email y último registro

## Estructura del Proyecto

```
rrhh-dango/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth endpoints
│   │   └── tmetric/check-hours/route.ts # API endpoint principal
│   ├── login/page.tsx                    # Página de login
│   ├── page.tsx                          # Dashboard (protegido)
│   ├── layout.tsx                        # Layout raíz
│   └── globals.css                       # Estilos globales
├── components/
│   ├── Dashboard.tsx                     # Componente principal del dashboard
│   └── UserTable.tsx                     # Tabla de usuarios
├── lib/
│   ├── auth.ts                          # Configuración NextAuth
│   ├── tmetric-scraper.ts               # Lógica de scraping con Playwright
│   ├── date-utils.ts                    # Utilidades para días laborables
│   └── types.ts                         # Tipos TypeScript
├── middleware.ts                         # Protección de rutas
├── .env.example                         # Plantilla de variables de entorno
├── PLAN.md                              # Plan de arquitectura detallado
└── README.md                            # Este archivo
```

## Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar en producción
npm start

# Linter
npm run lint

# Type checking
npm run type-check
```

## Configuración Avanzada

### Modo Headless de Playwright

Por defecto, Playwright ejecuta en modo headless en producción y headed en desarrollo.

Para cambiar este comportamiento, edita [lib/tmetric-scraper.ts:123](lib/tmetric-scraper.ts#L123):

```typescript
const browser = await chromium.launch({
  headless: true, // false para ver el navegador
  timeout: 60000,
});
```

### Timeout de Operaciones

Ajusta los timeouts en [lib/tmetric-scraper.ts:138](lib/tmetric-scraper.ts#L138):

```typescript
page.setDefaultTimeout(30000); // 30 segundos (ajustar según necesidad)
```

## Troubleshooting

### Error: "TMetric credentials not configured"

Verifica que `TMETRIC_EMAIL` y `TMETRIC_PASSWORD` estén correctamente configurados en `.env.local`.

### Error de Autenticación: "Credenciales incorrectas"

Verifica que estés usando el email y password configurados en `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

### Playwright Timeout

Si el scraping falla por timeout:

1. Aumenta el timeout en `lib/tmetric-scraper.ts`
2. Verifica tu conexión a internet
3. Verifica que las credenciales de TMetric sean correctas

### Selectores HTML Inválidos

TMetric puede cambiar su estructura HTML. Si el scraping falla:

1. Inspecciona la UI de TMetric con DevTools
2. Actualiza los selectores en [lib/tmetric-scraper.ts](lib/tmetric-scraper.ts)
3. Ejecuta en modo headed (`headless: false`) para debug

## Limitaciones Conocidas

1. **Scraping Lento**: El proceso puede tomar 30-90 segundos
2. **Fragilidad**: Cambios en la UI de TMetric requieren actualización de selectores
3. **Sin Historial**: Los datos no se persisten (consulta en tiempo real)
4. **Feriados**: No considera feriados, solo fines de semana
5. **Usuario Único**: Solo un administrador puede acceder al sistema

## Roadmap

### v1.1 (Próximas Semanas)
- [ ] Cache de resultados (5 minutos)
- [ ] Mejor manejo de errores con logs
- [ ] Exportar resultados a CSV
- [ ] Considerar feriados nacionales

### v2.0 (Próximos Meses)
- [ ] Base de datos PostgreSQL para historial
- [ ] Notificaciones por email
- [ ] Programación automática (cron jobs)
- [ ] Integración con Slack

### v3.0 (Futuro)
- [ ] Multi-usuario con roles
- [ ] Reportes avanzados y gráficos
- [ ] Multi-tenancy (múltiples organizaciones)

## Despliegue

### Vercel (Recomendado)

1. Haz fork del repositorio
2. Conecta tu cuenta de Vercel
3. Configura las variables de entorno en Vercel Dashboard
4. Deploy automático

**Nota**: Vercel tiene limitaciones para Playwright. Considera usar Railway o Render para mejor compatibilidad.

### Railway / Render

1. Conecta el repositorio
2. Configura variables de entorno
3. Asegúrate de que Playwright esté instalado en el build

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios siguiendo [Conventional Commits](https://www.conventionalcommits.org/)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Seguridad

- **No commitear** el archivo `.env.local` (está en `.gitignore`)
- Usar passwords seguros para `ADMIN_PASSWORD`
- Cambiar `NEXTAUTH_SECRET` por un valor aleatorio
- Las credenciales de TMetric solo son accesibles desde el servidor

## Licencia

ISC

## Contacto

Para preguntas, bugs o sugerencias:
- **GitHub Issues**: [https://github.com/pablog1/rrhh-dango/issues](https://github.com/pablog1/rrhh-dango/issues)

---

**Desarrollado con** ❤️ **usando Next.js, TypeScript y Playwright**
