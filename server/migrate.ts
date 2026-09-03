import { pool } from './db.js';
import { applyPendingMigrations } from './migrations.js';

async function migrate() {
  try {
    const applied = await applyPendingMigrations();
    for (const file of applied) console.log(`Applied migration: ${file}`);
    console.log('Migrations up to date.');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
