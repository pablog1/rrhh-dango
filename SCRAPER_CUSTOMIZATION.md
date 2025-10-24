# Guía de Personalización del Scraper de TMetric

Este documento te guiará paso a paso para adaptar el scraper a la estructura real de TMetric.

## 🎯 Objetivo

El scraper necesita:
1. Login a TMetric
2. Navegar a la sección de reportes/equipo
3. Obtener lista de empleados RRHH
4. Para cada empleado, verificar si tiene time entries en los últimos 2 días laborables
5. Retornar lista de usuarios sin registros

## 🔍 Paso 1: Analizar la Interfaz de TMetric

### 1.1 Explorar Manualmente

1. Abre TMetric en tu navegador
2. Login con tus credenciales
3. Navega por las secciones:
   - **Dashboard**: ¿Hay información de equipo?
   - **Reports**: ¿Tiene vista de equipo/usuarios?
   - **Team**: ¿Lista todos los miembros?
   - **Time Tracking**: ¿Muestra entradas por usuario?

### 1.2 Identificar la Mejor Ruta

Anota la ruta de navegación óptima:
```
Ejemplo:
Login → Dashboard → Reports → Team Summary → Filtrar por fecha
```

## 🛠️ Paso 2: Obtener Selectores CSS

### 2.1 Login Page

Abre DevTools (F12) en la página de login y encuentra:

**Campo de Email:**
```typescript
// Opciones comunes:
input[name="email"]
input[type="email"]
#email
.login-email-input
```

**Campo de Password:**
```typescript
// Opciones comunes:
input[name="password"]
input[type="password"]
#password
.login-password-input
```

**Botón de Submit:**
```typescript
// Opciones comunes:
button[type="submit"]
button:has-text("Sign in")
.login-button
#login-submit
```

### 2.2 Página Principal (después del login)

Identifica la URL después del login exitoso:
```typescript
// Ejemplo:
https://app.tmetric.com/dashboard
https://app.tmetric.com/workspace/{id}
```

### 2.3 Sección de Reportes/Equipo

Encuentra cómo llegar a la vista de equipo:

**Link/Botón de Reportes:**
```typescript
// Ejemplos:
a[href*="reports"]
button:has-text("Reports")
nav >> text=Reports
```

**Filtro de Fechas:**
```typescript
// Busca date pickers o inputs de fecha
input[type="date"]
.date-range-picker
[data-test-id="start-date"]
```

## 📝 Paso 3: Estructura de Datos

### 3.1 Lista de Usuarios

Inspecciona la tabla/lista de usuarios:

```html
<!-- Ejemplo de estructura HTML -->
<div class="users-list">
  <div class="user-row" data-user-id="123">
    <span class="user-name">Juan Pérez</span>
    <span class="user-email">juan@empresa.com</span>
  </div>
  <div class="user-row" data-user-id="124">
    <span class="user-name">María López</span>
    <span class="user-email">maria@empresa.com</span>
  </div>
</div>
```

Selectores a usar:
```typescript
const userRows = await page.$$('.user-row');
const userId = await userRow.getAttribute('data-user-id');
const name = await userRow.$eval('.user-name', el => el.textContent);
const email = await userRow.$eval('.user-email', el => el.textContent);
```

### 3.2 Time Entries por Usuario

Identifica cómo ver las entradas de tiempo:

**Opción A: Vista de tabla con todas las entradas**
```typescript
// Selector para filas de time entries
const timeEntries = await page.$$('.time-entry-row');
```

**Opción B: Click en usuario para ver detalle**
```typescript
await userRow.click();
await page.waitForSelector('.user-detail-panel');
const entries = await page.$$('.time-entry');
```

## 💻 Paso 4: Actualizar el Código

### 4.1 Función `loginToTMetric`

Ubicación: [lib/tmetric-scraper.ts:16-31](lib/tmetric-scraper.ts#L16-L31)

```typescript
async function loginToTMetric(page: Page, credentials: TMetricCredentials): Promise<void> {
  console.log('[TMetric] Navigating to login page...');
  await page.goto('https://app.tmetric.com/login', { waitUntil: 'networkidle' });

  // TODO: Actualizar estos selectores
  await page.waitForSelector('TU_SELECTOR_EMAIL', { timeout: 10000 });
  await page.fill('TU_SELECTOR_EMAIL', credentials.email);
  await page.fill('TU_SELECTOR_PASSWORD', credentials.password);

  await page.click('TU_SELECTOR_SUBMIT_BUTTON');

  // TODO: Actualizar la URL esperada después del login
  await page.waitForURL('**/URL_DESPUES_LOGIN**', { timeout: 15000 });

  console.log('[TMetric] Login successful!');
}
```

### 4.2 Función `getUsersWithoutHours`

Ubicación: [lib/tmetric-scraper.ts:42-109](lib/tmetric-scraper.ts#L42-L109)

```typescript
async function getUsersWithoutHours(
  page: Page,
  fromDate: Date,
  toDate: Date
): Promise<UserWithoutHours[]> {

  // Paso 1: Navegar a la sección correcta
  await page.goto('TU_URL_DE_REPORTES', { waitUntil: 'networkidle' });

  // Paso 2: Configurar filtro de fechas (si es necesario)
  // Ejemplo:
  await page.fill('SELECTOR_FECHA_INICIO', toISODate(fromDate));
  await page.fill('SELECTOR_FECHA_FIN', toISODate(toDate));
  await page.click('SELECTOR_BOTON_APLICAR_FILTRO');
  await page.waitForLoadState('networkidle');

  // Paso 3: Obtener lista de usuarios
  const userElements = await page.$$('TU_SELECTOR_FILAS_USUARIO');
  const users: UserWithoutHours[] = [];

  for (const userEl of userElements) {
    try {
      // Extraer información del usuario
      const userId = await userEl.getAttribute('data-user-id') || '';
      const name = await userEl.$eval('.user-name', el => el.textContent?.trim() || 'Unknown');
      const email = await userEl.$eval('.user-email', el => el.textContent?.trim() || '');

      // Verificar si tiene time entries
      // Opción A: Contar elementos de tiempo en la fila
      const timeEntriesCount = await userEl.$$eval('.time-entry', entries => entries.length);
      const hasEntries = timeEntriesCount > 0;

      // Opción B: Buscar indicador de "sin horas"
      // const noHoursIndicator = await userEl.$('.no-hours-badge');
      // const hasEntries = !noHoursIndicator;

      if (!hasEntries) {
        users.push({
          id: userId,
          name,
          email,
          lastEntry: null, // TODO: Implementar si es posible obtener última fecha
        });
      }
    } catch (err) {
      console.error('[TMetric] Error processing user:', err);
    }
  }

  return users;
}
```

## 🧪 Paso 5: Testing

### 5.1 Ejecutar en Modo Headed

En [lib/tmetric-scraper.ts:123](lib/tmetric-scraper.ts#L123):

```typescript
const browser = await chromium.launch({
  headless: false, // Ver el navegador
  slowMo: 500,     // Ralentizar para observar
  timeout: 60000,
});
```

### 5.2 Agregar Logs de Debug

```typescript
// Agregar logs temporales para debugging
console.log('[DEBUG] Current URL:', page.url());
console.log('[DEBUG] Found users:', userElements.length);
console.log('[DEBUG] User data:', { userId, name, email });
```

### 5.3 Capturar Screenshots

```typescript
// Útil para ver el estado de la página
await page.screenshot({ path: 'debug-login.png' });
await page.screenshot({ path: 'debug-reports.png' });
```

## 🎯 Estrategias Alternativas

### Si TMetric tiene API interna

Inspecciona las llamadas de red en DevTools (pestaña Network):

1. Filtra por `XHR` o `Fetch`
2. Busca llamadas a endpoints como:
   - `/api/users`
   - `/api/time-entries`
   - `/api/reports`

Si encuentras una API interna, puedes usar `fetch` en lugar de scraping:

```typescript
// Obtener cookies de sesión después del login
const cookies = await context.cookies();

// Hacer request a API interna
const response = await page.evaluate(async (fromDate, toDate) => {
  const res = await fetch('/api/time-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: fromDate, endDate: toDate }),
  });
  return res.json();
}, fromDate, toDate);
```

## 📋 Checklist de Implementación

- [ ] Selectores de login identificados
- [ ] URL post-login identificada
- [ ] Ruta de navegación a reportes definida
- [ ] Selectores de usuarios identificados
- [ ] Lógica de extracción de time entries implementada
- [ ] Testing en modo headed exitoso
- [ ] Manejo de errores agregado
- [ ] Probado con datos reales
- [ ] Optimizado para modo headless

## 🔗 Recursos Útiles

- [Playwright Selectors](https://playwright.dev/docs/selectors)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [CSS Selectors Reference](https://www.w3schools.com/cssref/css_selectors.asp)

---

**Tip Final**: Empieza simple y ve agregando complejidad. Primero haz que el login funcione, luego la navegación, y finalmente la extracción de datos.
