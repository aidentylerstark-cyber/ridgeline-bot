import 'dotenv/config';
import { waitForDatabase } from './index.js';
import { runMigrations } from './migrate.js';

console.log('[Avery] Waiting for database...');
waitForDatabase()
  .then(() => {
    console.log('[Avery] Running database migrations...');
    return runMigrations();
  })
  .then(() => {
    console.log('[Avery] Migrations complete — database is ready');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Avery] Migration failed:', err);
    process.exit(1);
  });
