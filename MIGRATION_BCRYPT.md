# Migración a Autenticación con Bcrypt

## ¿Qué cambió?

Anteriormente, la contraseña del admin se guardaba en texto plano en `.env`:
```bash
# ❌ Antes (INSEGURO)
ADMIN_PASSWORD=mi-contraseña-123
```

Ahora usamos **bcrypt hash** para mayor seguridad:
```bash
# ✅ Ahora (SEGURO)
ADMIN_PASSWORD_HASH=$2b$12$xyz...abc
```

## Pasos para Migrar

### 1. Genera el hash de tu contraseña actual

```bash
node scripts/generate-password-hash.js "tu-contraseña-actual"
```

**Ejemplo:**
```bash
$ node scripts/generate-password-hash.js "LaudatoSi"

🔐 Generando hash bcrypt...

✅ Hash generado exitosamente!

Copia esta línea en tu archivo .env:

ADMIN_PASSWORD_HASH=$2b$12$3LDpKxkQX97JqXkxu.v1zODwnH/ruCoJW25Wx0HAO3yrqF7fgWn6u
```

### 2. Actualiza tu archivo `.env.local`

Abre tu archivo `.env.local` y:

**a) Elimina la línea antigua:**
```bash
# ADMIN_PASSWORD=LaudatoSi  ← Eliminar esta línea
```

**b) Agrega el nuevo hash:**
```bash
ADMIN_PASSWORD_HASH=$2b$12$3LDpKxkQX97JqXkxu.v1zODwnH/ruCoJW25Wx0HAO3yrqF7fgWn6u
```

Tu archivo `.env.local` debería quedar así:
```bash
NEXTAUTH_SECRET=tu-secret-aqui
NEXTAUTH_URL=http://localhost:3000

ADMIN_EMAIL=pablo@dango.digital
ADMIN_PASSWORD_HASH=$2b$12$3LDpKxkQX97JqXkxu.v1zODwnH/ruCoJW25Wx0HAO3yrqF7fgWn6u

TMETRIC_EMAIL=tu-email-tmetric
TMETRIC_PASSWORD=tu-password-tmetric

SLACK_WEBHOOK_URL=https://hooks.slack.com/...
API_SECRET=tu-api-secret
```

### 3. Actualiza Railway

**En el dashboard de Railway:**

1. Ve a tu proyecto → Variables tab
2. **Elimina:** `ADMIN_PASSWORD` (si existe)
3. **Agrega:** `ADMIN_PASSWORD_HASH` con el valor del hash generado

### 4. Reinicia la aplicación

**Local:**
```bash
# Detén el servidor si está corriendo (Ctrl+C)
npm run dev
```

**Railway:**
- El redeploy se hace automáticamente al cambiar las variables de entorno

### 5. Prueba el login

Ve a `http://localhost:3000/login` e ingresa:
- **Email:** tu-email@dango.digital
- **Password:** tu-contraseña-original (la misma que usaste para generar el hash)

## ¿Por qué esto es más seguro?

### Antes ❌
```
Si alguien ve:  ADMIN_PASSWORD=LaudatoSi
Puede obtener:  Tu contraseña: "LaudatoSi"
```

### Ahora ✅
```
Si alguien ve:  ADMIN_PASSWORD_HASH=$2b$12$3LDp...
Puede obtener:  NADA - El hash es irreversible
```

## Ventajas de Bcrypt

1. **Irreversible:** No se puede "desencriptar" para obtener la contraseña
2. **Salt único:** Cada hash es diferente, incluso con la misma contraseña
3. **Resistente a fuerza bruta:** Diseñado para ser costoso computacionalmente
4. **Estándar de industria:** Usado por millones de aplicaciones

## Preguntas Frecuentes

### ¿Qué pasa si alguien obtiene mi hash?

No pueden obtener tu contraseña original. El hash bcrypt es una función de una sola vía (one-way function). Solo sirve para *verificar* si una contraseña es correcta, no para *recuperar* la contraseña.

### ¿Puedo usar la misma contraseña?

Sí, puedes seguir usando la misma contraseña que antes. Simplemente genera el hash de esa contraseña y úsala para login normalmente.

### ¿Cada vez que reinicio necesito regenerar el hash?

No. El hash se genera UNA SOLA VEZ y se guarda en `.env`. Luego lo usas indefinidamente hasta que quieras cambiar la contraseña.

### ¿Cómo cambio mi contraseña?

```bash
# 1. Genera el hash de la nueva contraseña
node scripts/generate-password-hash.js "nueva-contraseña"

# 2. Actualiza ADMIN_PASSWORD_HASH en .env.local y Railway

# 3. Reinicia el servidor
```

## Problemas Comunes

### "Invalid credentials" después de migrar

**Causa:** Probablemente el hash no se copió correctamente o la variable sigue siendo `ADMIN_PASSWORD` en lugar de `ADMIN_PASSWORD_HASH`.

**Solución:**
1. Verifica que el archivo `.env.local` tenga `ADMIN_PASSWORD_HASH` (no `ADMIN_PASSWORD`)
2. Verifica que copiaste el hash completo (empieza con `$2b$12$`)
3. Reinicia el servidor de desarrollo

### El hash se ve cortado

**Causa:** Los hashes bcrypt son largos (~60 caracteres).

**Solución:**
Asegúrate de copiar el hash completo, incluyendo todos los caracteres después de `$2b$12$`.

## Soporte

Si tienes problemas con la migración, revisa:
- [SECURITY.md](SECURITY.md) - Guía de seguridad completa
- [.env.example](.env.example) - Ejemplo de configuración

---

**Última actualización:** Octubre 2025
