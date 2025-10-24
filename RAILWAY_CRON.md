# Railway Cron - Ejecución Automática

Esta guía te muestra cómo configurar la ejecución automática del verificador de horas en Railway.

## 📋 Requisitos Previos

- Aplicación desplegada en Railway
- Variables de entorno configuradas en Railway
- API Secret generado

## 🔑 Variables de Entorno en Railway

Asegúrate de tener estas variables configuradas en Railway Dashboard:

```env
# TMetric - Credenciales
TMETRIC_EMAIL=tu-email@example.com
TMETRIC_PASSWORD=tu-password

# Slack - Webhook para notificaciones
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# API Secret - Token para autenticar cron jobs
# Generar con: openssl rand -hex 32
API_SECRET=tu-secret-token-aqui-min-64-chars

# NextAuth
NEXTAUTH_SECRET=tu-nextauth-secret
NEXTAUTH_URL=https://tu-app.railway.app
```

## 🚀 Configurar Cron en Railway

### Opción 1: Railway Cron Jobs (Recomendado)

Railway tiene soporte nativo para cron jobs.

1. **En Railway Dashboard:**
   - Ve a tu proyecto
   - Click en tu servicio
   - Ve a la pestaña "Settings"
   - Busca la sección "Cron Jobs" (si está disponible en tu plan)

2. **Configurar el Cron Job:**
   - Schedule: `0 18 * * 1-5` (6 PM, lunes a viernes)
   - Command: Script que ejecute el endpoint

### Opción 2: Servicio Externo (EasyCron, cron-job.org)

Si Railway no tiene cron nativo en tu plan, usa un servicio externo:

#### Usando EasyCron (Gratis hasta 20 jobs)

1. **Regístrate en:** https://www.easycron.com
2. **Crear nuevo Cron Job:**
   - URL: `https://tu-app.railway.app/api/cron/check-hours`
   - Cron Expression: `0 18 * * 1-5`
   - HTTP Method: `POST`
   - HTTP Headers:
     ```
     Authorization: Bearer [TU_API_SECRET]
     Content-Type: application/json
     ```
   - Timeout: 120 segundos

#### Usando cron-job.org (Gratis)

1. **Regístrate en:** https://cron-job.org
2. **Crear nuevo Cronjob:**
   - Title: "RRHH - Verificar Horas TMetric"
   - Address: `https://tu-app.railway.app/api/cron/check-hours`
   - Schedule: `0 18 * * 1-5` o usar UI visual
   - Request method: POST
   - Headers:
     ```
     Authorization: Bearer [TU_API_SECRET]
     Content-Type: application/json
     ```

### Opción 3: Script Node.js en Railway

Crear un servicio separado en Railway que ejecute el cron:

**cron-service.js:**
```javascript
const cron = require('node-cron');

// Ejecutar de lunes a viernes a las 6 PM
cron.schedule('0 18 * * 1-5', async () => {
  console.log('Ejecutando verificación de horas...');

  const response = await fetch(process.env.APP_URL + '/api/cron/check-hours', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.API_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();
  console.log('Resultado:', result);
});

console.log('Cron service iniciado');
```

## 📅 Cron Schedule Examples

```bash
# Cada día laborable a las 6 PM
0 18 * * 1-5

# Cada día laborable a las 9 AM y 6 PM
0 9,18 * * 1-5

# Cada hora de 9 AM a 6 PM, lunes a viernes
0 9-18 * * 1-5

# Cada 30 minutos durante horario laboral
*/30 9-18 * * 1-5
```

## 🧪 Probar el Endpoint

### Desde tu terminal local:

```bash
curl -X POST https://tu-app.railway.app/api/cron/check-hours \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TU_API_SECRET]"
```

### Respuesta esperada:

```json
{
  "success": true,
  "data": {
    "dateRange": {
      "from": "2025-10-22",
      "to": "2025-10-24"
    },
    "usersWithoutHours": [...],
    "totalUsers": 3,
    "checkedAt": "2025-10-24T18:00:00.000Z"
  }
}
```

## 📊 Monitoreo

### Logs en Railway

Para ver los logs del cron job:
1. Ve a Railway Dashboard
2. Selecciona tu servicio
3. Click en "Deployments" → "View Logs"
4. Busca: `[API Cron]` en los logs

### Notificaciones en Slack

Cada ejecución enviará un mensaje automático a tu canal de Slack configurado:
- ✅ Si no hay usuarios sin horas
- ⚠️ Si hay usuarios sin horas (con detalle)
- 🤖 Marcado como "Verificación Automática"

## 🔒 Seguridad

### Generar API Secret seguro:

```bash
# Generar un token de 64 caracteres
openssl rand -hex 32
```

### Mejores prácticas:

1. **Nunca** commitees el `API_SECRET` al repositorio
2. Usa variables de entorno en Railway
3. Rota el secret periódicamente
4. Usa HTTPS siempre (Railway lo hace por defecto)
5. Monitorea los logs para detectar accesos no autorizados

## ❌ Troubleshooting

### Error 401 Unauthorized

```json
{"success":false,"error":"Unauthorized - Invalid API key"}
```

**Solución:** Verifica que el `Authorization` header tenga el formato correcto:
```
Authorization: Bearer [tu-secret-sin-corchetes]
```

### Error 500 API_SECRET not configured

```json
{"success":false,"error":"API_SECRET not configured on server"}
```

**Solución:** Agrega `API_SECRET` a las variables de entorno en Railway Dashboard.

### Timeout / No responde

**Solución:** El scraping puede tomar 10-20 segundos. Configura timeout de al menos 60 segundos en tu servicio de cron.

### No llegan notificaciones a Slack

**Solución:**
1. Verifica que `SLACK_WEBHOOK_URL` esté configurado en Railway
2. Prueba el webhook manualmente con curl
3. Revisa los logs para ver errores de Slack

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Cron Expression Generator](https://crontab.guru)
- [EasyCron](https://www.easycron.com)
- [cron-job.org](https://cron-job.org)
