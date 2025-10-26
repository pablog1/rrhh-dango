# Guía de Seguridad

## Configuración de Contraseñas Seguras

### ⚠️ NUNCA guardes contraseñas en texto plano

Este proyecto usa **bcrypt** para hashear contraseñas. Esto significa que:

- ✅ Las contraseñas nunca se almacenan en texto plano
- ✅ Incluso si alguien ve tu `.env`, no puede obtener la contraseña original
- ✅ Los hashes bcrypt son irreversibles y resistentes a ataques de fuerza bruta

### Generar Hash de Contraseña

**Paso 1: Genera el hash de tu contraseña**

```bash
node scripts/generate-password-hash.js "tu-contraseña-super-segura"
```

**Paso 2: Copia el hash generado**

El script te dará algo como:
```
ADMIN_PASSWORD_HASH=$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYa3V
```

**Paso 3: Pégalo en tu archivo `.env.local`**

```bash
# .env.local
ADMIN_EMAIL=tu-email@dango.digital
ADMIN_PASSWORD_HASH=$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYa3V
```

### Ejemplo Completo

```bash
# 1. Generar hash
$ node scripts/generate-password-hash.js "MiPasswordSeguro123!"

🔐 Generando hash bcrypt...

✅ Hash generado exitosamente!

Copia esta línea en tu archivo .env:

ADMIN_PASSWORD_HASH=$2b$12$xyz...abc

# 2. Agregar a .env.local
$ echo 'ADMIN_PASSWORD_HASH=$2b$12$xyz...abc' >> .env.local

# 3. Login con la contraseña original
# Email: tu-email@dango.digital
# Password: MiPasswordSeguro123!
```

## Buenas Prácticas

### ✅ Hacer

1. **Usar contraseñas fuertes**
   - Mínimo 12 caracteres
   - Combinar mayúsculas, minúsculas, números y símbolos
   - Ejemplo: `P@ssw0rd_2025!Secure`

2. **Mantener secretos fuera del repositorio**
   - Nunca hacer commit de `.env` o `.env.local`
   - Usar `.env.example` solo con valores de ejemplo

3. **Regenerar secretos regularmente**
   - Cambiar `NEXTAUTH_SECRET` cada 6 meses
   - Cambiar `API_SECRET` si se sospecha exposición

4. **Variables de entorno en Railway/Vercel**
   - Configurar manualmente en el dashboard
   - NO incluirlas en el código

### ❌ Evitar

1. **NO usar contraseñas en texto plano**
   ```bash
   # ❌ MAL
   ADMIN_PASSWORD=password123

   # ✅ BIEN
   ADMIN_PASSWORD_HASH=$2b$12$xyz...abc
   ```

2. **NO compartir el archivo `.env`**
   - Ni por Slack, email, o GitHub
   - Usa gestores de secretos (1Password, Bitwarden)

3. **NO commitear secretos**
   - Verificar `.gitignore` incluye `.env*`
   - Usar `git secrets` para prevención

## Variables de Entorno Sensibles

| Variable | Descripción | Sensibilidad |
|----------|-------------|--------------|
| `NEXTAUTH_SECRET` | Secret para firmar JWTs | 🔴 Alta |
| `ADMIN_PASSWORD_HASH` | Hash de contraseña admin | 🟡 Media |
| `ADMIN_EMAIL` | Email del admin | 🟢 Baja |
| `TMETRIC_EMAIL` | Email para TMetric | 🟡 Media |
| `TMETRIC_PASSWORD` | Password TMetric | 🔴 Alta |
| `API_SECRET` | Secret para cron jobs | 🔴 Alta |
| `SLACK_WEBHOOK_URL` | URL webhook Slack | 🟡 Media |

## Rotación de Secretos

### Cambiar Contraseña de Admin

```bash
# 1. Generar nuevo hash
node scripts/generate-password-hash.js "nueva-contraseña"

# 2. Actualizar .env.local
# 3. Reiniciar servidor
npm run dev
```

### Regenerar NEXTAUTH_SECRET

```bash
# Generar nuevo secret
openssl rand -base64 32

# Actualizar en .env.local y Railway
```

## Auditoría de Seguridad

Revisa periódicamente:

- [ ] Contraseñas fuertes y únicas
- [ ] Secretos rotados regularmente
- [ ] `.env` no está en git
- [ ] Variables de entorno configuradas en Railway
- [ ] Logs no exponen credenciales

## Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor:

1. **NO** abras un issue público
2. Contacta directamente al equipo
3. Espera respuesta antes de divulgar

---

**Última actualización:** Octubre 2025
