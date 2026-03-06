import 'dotenv/config';
import { runMigrations } from './migrate.js';

console.log('[Peaches] Running database migrations...');
runMigrations()
  .then(() => {
    console.log('[Peaches] Migrations complete — database is ready');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Peaches] Migration failed:', err);
    process.exit(1);
  });
