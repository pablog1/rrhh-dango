# GitHub Actions - Verificación Automática de Horas

Este documento explica cómo configurar la verificación automática de horas usando GitHub Actions.

## 📋 Requisitos Previos

1. Tu aplicación debe estar desplegada y accesible públicamente (ej: Vercel, Railway, etc.)
2. Tener acceso al repositorio en GitHub
3. Tener permisos para configurar Secrets en el repositorio

## 🔧 Configuración

### Paso 1: Configurar Secrets en GitHub

Ve a tu repositorio → Settings → Secrets and variables → Actions → New repository secret

Crea los siguientes secrets:

#### `API_SECRET` (Requerido)
- **Descripción**: Clave secreta para autenticar las llamadas al API
- **Valor**: Genera una clave segura (ej: usando `openssl rand -hex 32`)
- **Ejemplo**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

#### `APP_URL` (Requerido)
- **Descripción**: URL donde está desplegada tu aplicación
- **Valor**: URL completa sin trailing slash
- **Ejemplo**: `https://rrhh-dango.vercel.app`

#### `SLACK_WEBHOOK_URL` (Opcional)
- **Descripción**: Webhook de Slack para enviar notificaciones
- **Valor**: URL del webhook de Slack
- **Ejemplo**: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

### Paso 2: Agregar API_SECRET al .env de tu aplicación

En tu servidor de producción, agrega la misma `API_SECRET` a las variables de entorno:

```bash
API_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Importante**: Este valor debe ser el mismo que configuraste en GitHub Secrets.

### Paso 3: Verificar configuración de TMetric

Asegúrate de que tu aplicación en producción tenga configuradas las credenciales de TMetric:

```bash
TMETRIC_EMAIL=tu-email@ejemplo.com
TMETRIC_PASSWORD=tu-password
```

## 🚀 Uso

### Ejecución Manual

1. Ve a tu repositorio en GitHub
2. Click en **Actions**
3. Selecciona **Check TMetric Hours** en el menú izquierdo
4. Click en **Run workflow**
5. Selecciona la rama y opciones:
   - ☑️ **Send notification if users found**: Enviar notificaciones si encuentra usuarios sin horas
6. Click en **Run workflow**

### Ejecución Automática (Cron)

Para habilitar ejecución automática:

1. Abre el archivo `.github/workflows/check-hours.yml`
2. Descomenta las líneas del `schedule`:

```yaml
  schedule:
    # Ejecutar de lunes a viernes a las 6 PM (18:00 UTC)
    - cron: '0 18 * * 1-5'
```

3. Modifica el horario según necesites:
   - `'0 18 * * 1-5'` = Lunes a Viernes a las 6 PM UTC
   - `'0 9 * * 1-5'` = Lunes a Viernes a las 9 AM UTC
   - `'0 12 * * *'` = Todos los días a las 12 PM UTC

**Nota**: Los horarios están en UTC. Para Argentina (UTC-3), resta 3 horas.

## 📊 Resultados

Cuando se ejecuta el workflow:

1. **Artifacts**: Los resultados se guardan como artefactos y se pueden descargar por 30 días
2. **GitHub Issues**: Si encuentra usuarios sin horas, crea automáticamente una issue con:
   - Lista de usuarios
   - Días sin registros
   - Último registro de cada uno
   - Labels: `automated`, `rrhh`, `hours-check`
3. **Logs**: Todos los logs están disponibles en la pestaña Actions

## 🔔 Notificaciones

### Slack (Opcional)

Para habilitar notificaciones de Slack:

1. Crea un Incoming Webhook en Slack:
   - Ve a https://api.slack.com/apps
   - Crea una nueva app o selecciona una existente
   - Activa "Incoming Webhooks"
   - Crea un nuevo webhook para tu canal
   - Copia la URL

2. Agrega el webhook a GitHub Secrets como `SLACK_WEBHOOK_URL`

3. Descomenta las líneas en `.github/workflows/check-hours.yml`:

```yaml
      - name: Send notification (if users found)
        if: steps.check.outputs.total_users > 0 && inputs.notify == 'true'
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"⚠️ RRHH Alert: ${{ steps.check.outputs.total_users }} usuarios sin horas registradas"}'
```

## 🧪 Pruebas

Para probar la configuración:

1. **Prueba local del endpoint**:
```bash
curl -X POST http://localhost:3000/api/cron/check-hours \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_API_SECRET"
```

2. **Prueba en producción**:
```bash
curl -X POST https://tu-app.vercel.app/api/cron/check-hours \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_API_SECRET"
```

## 🔒 Seguridad

- ✅ El endpoint `/api/cron/check-hours` requiere autenticación con Bearer token
- ✅ La API_SECRET no se expone en los logs
- ✅ Las credenciales de TMetric están en variables de entorno
- ✅ Los secrets de GitHub están encriptados

## 📝 Troubleshooting

### Error: "Unauthorized - Invalid API key"
- Verifica que `API_SECRET` esté configurado en GitHub Secrets
- Verifica que `API_SECRET` esté en las variables de entorno de tu app
- Asegúrate de que sean exactamente iguales

### Error: "API_SECRET not configured on server"
- Agrega `API_SECRET` a las variables de entorno de tu servidor de producción

### Error: "TMetric credentials not configured"
- Verifica que `TMETRIC_EMAIL` y `TMETRIC_PASSWORD` estén en las variables de entorno

### El workflow no se ejecuta automáticamente
- Verifica que hayas descomentado las líneas del `schedule`
- El cron de GitHub puede tener hasta 15 minutos de delay
- GitHub puede deshabilitar workflows en repos inactivos

## 📚 Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Expression Generator](https://crontab.guru/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
