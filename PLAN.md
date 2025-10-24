# Plan de Implementación: Sistema de Detección de Horas RRHH en TMetric

## Descripción General

Sistema web para detectar empleados de RRHH que no han registrado horas en TMetric durante los últimos 2 días laborables (excluyendo fines de semana). El sistema utiliza automatización de navegador para conectarse a TMetric mediante credenciales de usuario.

## Arquitectura Técnica

### Stack Tecnológico

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript
- **Autenticación del Sistema**: NextAuth.js (credentials provider)
- **Automatización Web**: Playwright
- **Estilos**: Tailwind CSS
- **Utilidades de Fecha**: date-fns
- **Validación**: Zod (opcional)

### Estructura del Proyecto

```
rrhh-dango/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts            # Configuración NextAuth
│   │   │   └── tmetric/
│   │   │       └── check-hours/
│   │   │           └── route.ts            # Endpoint principal (protegido)
│   │   ├── login/
│   │   │   └── page.tsx                    # Página de login
│   │   ├── page.tsx                        # Dashboard principal (protegido)
│   │   ├── layout.tsx                      # Layout raíz
│   │   └── globals.css                     # Estilos globales
│   ├── components/
│   │   ├── LoginForm.tsx                   # Formulario de login
│   │   ├── Dashboard.tsx                   # Componente principal del dashboard
│   │   ├── UserTable.tsx                   # Tabla de usuarios sin horas
│   │   ├── RefreshButton.tsx              # Botón de actualización
│   │   ├── LogoutButton.tsx               # Botón de cerrar sesión
│   │   └── StatusIndicator.tsx            # Indicador visual de estado
│   ├── lib/
│   │   ├── auth.ts                        # Configuración de NextAuth
│   │   ├── tmetric-scraper.ts             # Lógica de scraping con Playwright
│   │   ├── date-utils.ts                  # Utilidades para días laborables
│   │   └── types.ts                       # Tipos TypeScript compartidos
│   └── middleware.ts                       # Middleware de autenticación
├── public/
├── .env.local                              # Variables de entorno (no commitear)
├── .env.example                            # Plantilla de variables de entorno
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── PLAN.md                                 # Este archivo
└── README.md                               # Documentación del proyecto
```

## Funcionalidades Principales

### 1. Autenticación del Sistema

**Objetivo**: Proteger el acceso al dashboard mediante login simple.

**Implementación**:
- NextAuth.js con Credentials Provider
- Un solo usuario administrador (credenciales en `.env.local`)
- Sesión persistente con JWT
- Middleware para proteger rutas privadas

**Variables de Entorno**:
```env
NEXTAUTH_SECRET=<secret-random-generado>
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<password-seguro>
```

**Flujo**:
1. Usuario accede a `/` → redirige a `/login` si no está autenticado
2. Ingresa email y password
3. NextAuth valida contra variables de entorno
4. Si es válido, crea sesión y redirige al dashboard
5. Sesión persistente mediante cookies HTTP-only

### 2. Automatización de TMetric (Web Scraping)

**Objetivo**: Obtener datos de usuarios y time entries sin acceso directo a la API.

**Implementación con Playwright**:

#### Paso 1: Login Automático
```typescript
// Pseudocódigo
async function loginToTMetric(page, email, password) {
  await page.goto('https://app.tmetric.com/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}
```

#### Paso 2: Navegación a Reportes
```typescript
async function navigateToReports(page) {
  await page.click('a[href*="reports"]');
  await page.waitForLoadState('networkidle');
}
```

#### Paso 3: Extracción de Datos
```typescript
async function getUsersWithoutHours(page, fromDate, toDate) {
  // Configurar filtro de fechas
  // Extraer lista de usuarios
  // Para cada usuario, verificar si tiene time entries
  // Retornar usuarios sin registros
}
```

**Variables de Entorno**:
```env
TMETRIC_EMAIL=tu-email@empresa.com
TMETRIC_PASSWORD=tu-password-tmetric
```

### 3. Lógica de Días Laborables

**Objetivo**: Calcular los últimos 2 días hábiles excluyendo fines de semana.

**Implementación**:
```typescript
function getLastTwoWorkdays(): { from: Date; to: Date } {
  const today = new Date();
  const workdays: Date[] = [];

  let currentDay = subDays(today, 1); // Empezar desde ayer

  while (workdays.length < 2) {
    const dayOfWeek = currentDay.getDay();
    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workdays.push(currentDay);
    }
    currentDay = subDays(currentDay, 1);
  }

  return {
    from: workdays[1], // Más antiguo
    to: workdays[0]    // Más reciente
  };
}
```

**Casos especiales** (futuro):
- Feriados nacionales
- Días de licencia programados

### 4. Dashboard y Frontend

**Componentes**:

#### a) Página de Login (`/login`)
- Formulario con email/password
- Validación de campos
- Manejo de errores de autenticación
- Loading state durante login

#### b) Dashboard Principal (`/`)
- Protegido por autenticación
- Botón "Verificar Horas en TMetric"
- Tabla con resultados
- Indicador de última actualización
- Botón de logout

#### c) Tabla de Usuarios
Columnas:
- Nombre del empleado
- Email
- Última fecha con registro
- Estado (🔴 Sin horas / 🟢 Con horas)

**Estados de UI**:
- **Loading**: Spinner durante scraping (puede tomar 30-60 segundos)
- **Success**: Mostrar tabla con datos
- **Error**: Mensaje de error con detalles
- **Empty**: "Todos los empleados registraron horas"

## API Routes

### POST `/api/tmetric/check-hours`

**Protección**: Requiere sesión válida de NextAuth

**Proceso**:
1. Validar sesión del usuario
2. Iniciar navegador Playwright (headless)
3. Login en TMetric con credenciales del `.env`
4. Calcular últimos 2 días laborables
5. Navegar a sección de reportes
6. Extraer lista de usuarios RRHH
7. Para cada usuario, verificar time entries en el rango de fechas
8. Filtrar usuarios sin registros
9. Cerrar navegador
10. Retornar JSON con resultados

**Response Schema**:
```typescript
{
  success: boolean;
  data?: {
    dateRange: {
      from: string; // ISO date
      to: string;   // ISO date
    };
    usersWithoutHours: Array<{
      id: string;
      name: string;
      email: string;
      lastEntry: string | null; // ISO date o null
    }>;
    totalUsers: number;
    checkedAt: string; // ISO timestamp
  };
  error?: string;
}
```

**Manejo de Errores**:
- Timeout de Playwright (90 segundos)
- Error de login (credenciales incorrectas)
- Cambios en estructura HTML de TMetric
- Rate limiting

## Seguridad

### Autenticación del Sistema
- ✅ Sesión con JWT firmado
- ✅ Cookies HTTP-only (no accesibles desde JS)
- ✅ CSRF protection (NextAuth default)
- ✅ Password en variable de entorno (nunca en código)
- ⚠️ Password en texto plano en `.env` (mejorar con hash en v2)

### Credenciales de TMetric
- ✅ Solo accesibles desde server-side (API Routes)
- ✅ Nunca expuestas al cliente
- ✅ No logueadas en consola
- ✅ Archivo `.env.local` en `.gitignore`

### Protección de Rutas
- ✅ Middleware verifica sesión en todas las rutas privadas
- ✅ API routes validan sesión antes de ejecutar
- ✅ Redirect automático a login si no autenticado

## Optimizaciones y Mejoras Futuras

### Fase 2 (Futuras Funcionalidades)
- [ ] Cache de resultados (Redis/memoria)
- [ ] Programación automática (cron jobs diarios)
- [ ] Notificaciones por email
- [ ] Notificaciones por Slack
- [ ] Filtros avanzados (por departamento, proyecto)
- [ ] Exportar resultados a CSV/Excel
- [ ] Gráficos y estadísticas
- [ ] Historial de verificaciones

### Fase 3 (Escalabilidad)
- [ ] Multi-tenancy (múltiples organizaciones)
- [ ] Base de datos para persistencia (PostgreSQL/MongoDB)
- [ ] Sistema de usuarios con roles (admin, viewer)
- [ ] Autenticación con OAuth (Google, Microsoft)
- [ ] Logs de auditoría
- [ ] Rate limiting más sofisticado
- [ ] Pool de navegadores Playwright
- [ ] Webhooks para integraciones

## Dependencias

### Producción
```json
{
  "next": "^14.2.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "next-auth": "^4.24.0",
  "playwright": "^1.42.0",
  "date-fns": "^3.3.0",
  "zod": "^3.22.0"
}
```

### Desarrollo
```json
{
  "typescript": "^5.3.0",
  "tailwindcss": "^3.4.0",
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0",
  "@types/node": "^20.11.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "eslint": "^8.56.0",
  "eslint-config-next": "^14.2.0"
}
```

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/pablog1/rrhh-dango.git
cd rrhh-dango
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Instalar navegadores Playwright
```bash
npx playwright install chromium
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

### 6. Compilar para producción
```bash
npm run build
npm start
```

## Testing

### Casos de Prueba Críticos

1. **Autenticación**
   - ✓ Login con credenciales correctas
   - ✓ Login con credenciales incorrectas
   - ✓ Acceso a ruta protegida sin sesión
   - ✓ Logout correcto

2. **Scraping**
   - ✓ Login exitoso en TMetric
   - ✓ Extracción de usuarios
   - ✓ Detección correcta de días laborables
   - ✓ Manejo de timeout
   - ✓ Manejo de errores de red

3. **Lógica de Negocio**
   - ✓ Cálculo de 2 días laborables (lunes a viernes)
   - ✓ Exclusión de fines de semana
   - ✓ Identificación correcta de usuarios sin horas

## Monitoreo y Logs

### Logs Importantes
- Login/logout de usuarios del sistema
- Ejecución de verificación de horas (timestamp, duración)
- Errores de Playwright
- Rate limiting activado

### Métricas
- Tiempo promedio de scraping
- Tasa de éxito/error
- Usuarios sin horas detectados por día

## Limitaciones Conocidas

1. **Performance**:
   - Scraping puede tomar 30-90 segundos
   - No apto para consultas simultáneas masivas

2. **Fragilidad**:
   - Dependiente de la estructura HTML de TMetric
   - Cambios en la UI de TMetric requieren actualización de selectores

3. **Escalabilidad**:
   - Sin base de datos, no hay historial
   - Un solo usuario administrador

4. **Feriados**:
   - No considera feriados nacionales (solo fines de semana)

## Roadmap

### v1.0 (MVP) - Semana 1
- ✅ Autenticación simple
- ✅ Scraping de TMetric
- ✅ Detección de usuarios sin horas
- ✅ Dashboard básico

### v1.1 - Semana 2-3
- [ ] Cache de resultados (5 minutos)
- [ ] Mejor manejo de errores
- [ ] Loading states mejorados
- [ ] Exportar a CSV

### v2.0 - Mes 2
- [ ] Base de datos PostgreSQL
- [ ] Historial de verificaciones
- [ ] Notificaciones por email
- [ ] Programación automática

### v3.0 - Mes 3+
- [ ] Multi-usuario
- [ ] Roles y permisos
- [ ] Integración con Slack
- [ ] Reportes avanzados

## Notas Técnicas

### Playwright Headless vs Headed
- **Desarrollo**: Modo headed (ver el navegador)
  ```typescript
  const browser = await chromium.launch({ headless: false });
  ```
- **Producción**: Modo headless (más rápido, menos recursos)
  ```typescript
  const browser = await chromium.launch({ headless: true });
  ```

### Rate Limiting
Implementar delay entre requests para evitar bloqueos de TMetric:
```typescript
await page.waitForTimeout(1000); // 1 segundo entre acciones
```

### Selectores CSS Robustos
Preferir selectores por data attributes o IDs únicos:
```typescript
// ❌ Frágil
await page.click('.btn-submit');

// ✅ Robusto
await page.click('[data-testid="submit-button"]');
await page.click('#login-submit');
```

## Contacto y Soporte

Para preguntas, bugs o sugerencias:
- GitHub Issues: https://github.com/pablog1/rrhh-dango/issues
- Email: [tu-email]

---

**Última actualización**: 2025-10-23
**Versión del plan**: 1.0
