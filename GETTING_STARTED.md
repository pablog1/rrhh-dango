# Guía de Inicio Rápido

Esta guía te ayudará a poner en marcha el sistema en menos de 10 minutos.

## ⚡ Inicio Rápido

### 1. Instalar Dependencias

```bash
npm install
npx playwright install chromium
```

### 2. Configurar Variables de Entorno

Crea el archivo `.env.local`:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus datos:

```env
# Genera un secret aleatorio:
# openssl rand -base64 32
NEXTAUTH_SECRET=tu-secret-generado-aqui-min-32-caracteres

NEXTAUTH_URL=http://localhost:3000

# Credenciales para acceder al sistema
ADMIN_EMAIL=admin@tuempresa.com
ADMIN_PASSWORD=TuPasswordSeguro123!

# Credenciales de TMetric
TMETRIC_EMAIL=tu-usuario@tmetric.com
TMETRIC_PASSWORD=tu-password-tmetric

NODE_ENV=development
```

### 3. Ejecutar en Modo Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 4. Primer Login

1. Serás redirigido a `/login`
2. Ingresa el `ADMIN_EMAIL` y `ADMIN_PASSWORD` que configuraste
3. Accederás al dashboard

### 5. Primera Verificación

1. Click en **"Verificar Horas"**
2. El sistema:
   - Abrirá un navegador (visible en desarrollo)
   - Se conectará a TMetric
   - Extraerá datos de usuarios
   - Mostrará resultados

⚠️ **IMPORTANTE**: La primera vez tomará más tiempo (30-90 segundos).

## 🔧 Configuración del Scraper

El archivo [lib/tmetric-scraper.ts](lib/tmetric-scraper.ts) contiene **selectores de ejemplo** que necesitan ser ajustados según la UI real de TMetric.

### Paso 1: Inspeccionar TMetric

1. Abre TMetric manualmente en tu navegador
2. Ve a DevTools (F12)
3. Navega a la sección de reportes/equipo
4. Inspecciona los elementos HTML para obtener selectores

### Paso 2: Actualizar Selectores

Edita `lib/tmetric-scraper.ts` en las siguientes funciones:

#### Login (líneas 16-31)
```typescript
// Actualiza estos selectores según TMetric
await page.fill('input[type="email"]', credentials.email);
await page.fill('input[type="password"]', credentials.password);
await page.click('button[type="submit"]');
```

#### Navegación a Reportes (líneas 50-54)
```typescript
// Actualiza la URL y selectores
await page.goto('https://app.tmetric.com/tracker', { waitUntil: 'networkidle' });
```

#### Extracción de Usuarios (líneas 67-108)
```typescript
// Esta es la parte más importante - adaptar completamente
const userElements = await page.$$('[data-user-id]');
// Reemplazar con selectores reales de TMetric
```

### Paso 3: Ejecutar en Modo Headed

Para ver qué está haciendo el navegador, edita [lib/tmetric-scraper.ts:123](lib/tmetric-scraper.ts#L123):

```typescript
const browser = await chromium.launch({
  headless: false, // Cambiar a false para ver el navegador
  timeout: 60000,
});
```

### Paso 4: Probar y Ajustar

1. Ejecuta la verificación
2. Observa el navegador
3. Anota qué elementos necesitas seleccionar
4. Actualiza los selectores
5. Repite hasta que funcione

## 🐛 Solución de Problemas

### "Credenciales incorrectas" al hacer login

- Verifica que `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env.local` coincidan con lo que ingresaste

### El scraper falla con timeout

- Aumenta el timeout en `lib/tmetric-scraper.ts` línea 138:
  ```typescript
  page.setDefaultTimeout(60000); // Aumentar a 60000 (60 seg)
  ```

### No encuentra elementos en TMetric

- Ejecuta en modo headed (`headless: false`)
- Inspecciona la UI de TMetric con DevTools
- Actualiza los selectores según la estructura real

### Error "TMetric credentials not configured"

- Verifica que `TMETRIC_EMAIL` y `TMETRIC_PASSWORD` estén en `.env.local`
- Asegúrate de que el archivo se llame exactamente `.env.local`

## 📝 Próximos Pasos

Una vez que el scraper funcione:

1. **Probar con datos reales**: Verifica que detecte correctamente usuarios sin horas
2. **Ajustar lógica de días laborables**: Si necesitas considerar feriados
3. **Agregar funcionalidades**: Notificaciones, exportar CSV, etc.
4. **Desplegar a producción**: Railway, Render o Vercel

## 💡 Tips

- **Desarrollo**: Usa modo headed para debugging
- **Producción**: Usa modo headless para performance
- **Selectores robustos**: Prefiere `data-*` attributes o IDs únicos
- **Logging**: Los logs en consola te ayudarán a debuggear

## 📚 Recursos

- [Documentación de Playwright](https://playwright.dev/docs/intro)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

¿Problemas? Abre un issue en [GitHub](https://github.com/pablog1/rrhh-dango/issues)
