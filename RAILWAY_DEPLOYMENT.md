# Railway Deployment con Playwright

Este proyecto usa Playwright para automatización web, lo cual requiere configuración especial en Railway.

## Configuración de Railway

Railway detectará automáticamente el `Dockerfile` y lo usará para el deployment.

### Variables de Entorno Requeridas

Asegúrate de tener estas variables configuradas en Railway (pestaña Variables):

```
NEXTAUTH_SECRET=<tu-secret-generado>
NEXTAUTH_URL=https://tu-app.up.railway.app
ADMIN_EMAIL=tu-email@ejemplo.com
ADMIN_PASSWORD=tu-contraseña
TMETRIC_EMAIL=tu-email-tmetric@empresa.com
TMETRIC_PASSWORD=tu-contraseña-tmetric
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
API_SECRET=tu-api-secret
```

**IMPORTANTE:** NO incluyas `NODE_ENV` en las variables. Railway lo configura automáticamente.

## Dockerfile

El proyecto incluye un `Dockerfile` optimizado que:

1. Usa `node:18-slim` como base
2. Instala todas las dependencias del sistema necesarias para Chromium
3. Instala Playwright y Chromium durante el build
4. Compila Next.js en modo standalone
5. Ejecuta la aplicación con `node .next/standalone/server.js`

## Troubleshooting

### Error: "Executable doesn't exist at /root/.cache/ms-playwright/chromium-XXXX/chrome-linux/chrome"

Este error significa que Playwright no se instaló correctamente. Soluciones:

1. **Verifica que Railway esté usando el Dockerfile**
   - Ve a Settings → Deploy
   - Debe mostrar "Dockerfile" como método de build

2. **Fuerza un nuevo deployment**
   - Ve a Deployments
   - Click en "Deploy" → "Redeploy"

3. **Revisa los logs del build**
   - Durante el deployment, deberías ver mensajes como:
     ```
     Installing Playwright browsers...
     Downloading Chromium...
     ```

### Error de Build

Si el build falla:

1. Verifica que no tengas `NODE_ENV` en las variables
2. Revisa los logs de Railway para ver el error específico
3. Asegúrate de que el Dockerfile esté commiteado en git

## Testing Local con Docker

Para probar el Dockerfile localmente:

```bash
# Build
docker build -t rrhh-dango .

# Run
docker run -p 3000:3000 \
  -e NEXTAUTH_SECRET=test-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@test.com \
  -e ADMIN_PASSWORD=test123 \
  -e TMETRIC_EMAIL=tu-email \
  -e TMETRIC_PASSWORD=tu-password \
  rrhh-dango
```

## Tiempo de Build

El primer deployment puede tardar **5-10 minutos** porque:
- Descarga dependencias del sistema (150+ MB)
- Descarga Chromium (~200 MB)
- Compila Next.js

Los deployments posteriores serán más rápidos gracias al cache de Railway.
