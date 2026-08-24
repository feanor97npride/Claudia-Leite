import { randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { hashPassword } from './auth.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@sistema.local';

function generateTempPassword(): string {
  // 16 random bytes -> base64url, trimmed to 20 chars: well above the 8-char
  // minimum, no ambiguous characters issue since it's never hand-typed twice.
  return randomBytes(16).toString('base64url').slice(0, 20);
}

/**
 * Bloco 0.2.1: creates a default Admin only if no admin exists yet — safe to
 * run on every deploy/startup, never duplicates or recreates the seed once a
 * real admin is present (whether it's still this seeded one or another).
 */
async function seedAdmin() {
  const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM users WHERE role = 'admin'");
  if (Number(rows[0].count) > 0) {
    console.log('An admin user already exists — skipping seed.');
    return;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role, must_change_password)
     VALUES ($1, $2, $3, 'admin', true)`,
    [ADMIN_EMAIL, passwordHash, 'Administrador'],
  );

  console.log('='.repeat(72));
  console.log('DEFAULT ADMIN CREATED — save these credentials, they will not be shown again:');
  console.log(`  E-mail: ${ADMIN_EMAIL}`);
  console.log(`  Senha temporária: ${tempPassword}`);
  console.log('  Troca de senha será exigida no primeiro login.');
  console.log('='.repeat(72));
}

seedAdmin()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
