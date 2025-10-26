#!/usr/bin/env node

/**
 * Script para generar hash bcrypt de contraseñas
 *
 * Uso:
 *   node scripts/generate-password-hash.js "tu-contraseña"
 *
 * El hash generado debe copiarse a la variable ADMIN_PASSWORD_HASH en .env
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Debes proporcionar una contraseña');
  console.error('\nUso:');
  console.error('  node scripts/generate-password-hash.js "tu-contraseña"\n');
  process.exit(1);
}

// Validar longitud mínima
if (password.length < 8) {
  console.error('❌ Error: La contraseña debe tener al menos 8 caracteres\n');
  process.exit(1);
}

// Generar hash con cost factor 12 (seguro pero no demasiado lento)
const saltRounds = 12;

console.log('🔐 Generando hash bcrypt...\n');

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('❌ Error generando hash:', err);
    process.exit(1);
  }

  console.log('✅ Hash generado exitosamente!\n');
  console.log('Copia esta línea en tu archivo .env:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  console.log('⚠️  IMPORTANTE: ');
  console.log('   1. NO compartas este hash públicamente (aunque es seguro)');
  console.log('   2. NO agregues este archivo al repositorio git');
  console.log('   3. Usa la misma contraseña que ingresaste para hacer login\n');
});
