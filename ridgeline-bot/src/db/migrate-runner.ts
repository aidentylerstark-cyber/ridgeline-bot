import 'dotenv/config';
import { runMigrations } from './migrate.js';

console.log('[Avery] Running database migrations...');
runMigrations()
  .then(() => {
    console.log('[Avery] Migrations complete — database is ready');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Avery] Migration failed:', err);
    process.exit(1);
  });
