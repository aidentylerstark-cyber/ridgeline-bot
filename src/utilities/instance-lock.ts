/**
 * Database-backed instance lock — ensures only ONE bot process handles messages.
 *
 * On Railway (or any host that briefly overlaps old/new containers during deploy),
 * the new instance claims the lock and the old one detects it lost ownership and
 * shuts down gracefully.
 */
import { pool } from '../db/index.js';
import crypto from 'crypto';
import type { Client } from 'discord.js';

const INSTANCE_ID = crypto.randomUUID();
let active = true;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
const MAX_HEARTBEAT_FAILURES = 3;

/** Create the lock table if needed, then claim ownership. */
export async function claimInstanceLock(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_instance_lock (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      instance_id text NOT NULL,
      claimed_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    INSERT INTO bot_instance_lock (id, instance_id, claimed_at)
    VALUES (1, $1, now())
    ON CONFLICT (id) DO UPDATE
      SET instance_id = $1, claimed_at = now()
  `, [INSTANCE_ID]);

  console.log(`[Peaches] Claimed instance lock: ${INSTANCE_ID.slice(0, 8)}`);
}

/**
 * Start a periodic check (every 5 s). If another instance has claimed the lock,
 * destroy the client and exit the process so Railway doesn't keep the old
 * container alive.
 */
export function startInstanceHeartbeat(client: Client): void {
  heartbeatTimer = setInterval(async () => {
    try {
      const { rows } = await pool.query(
        'SELECT instance_id FROM bot_instance_lock WHERE id = 1'
      );
      consecutiveFailures = 0; // Reset on success
      if (rows[0]?.instance_id !== INSTANCE_ID) {
        console.log('[Peaches] Another instance took over — shutting down old bot');
        active = false;
        stopInstanceHeartbeat();
        client.destroy();
        // Give a moment for cleanup then exit
        setTimeout(() => process.exit(0), 1000);
      }
    } catch (err) {
      consecutiveFailures++;
      console.error(`[Peaches] Instance heartbeat check failed (${consecutiveFailures}/${MAX_HEARTBEAT_FAILURES}):`, err);
      if (consecutiveFailures >= MAX_HEARTBEAT_FAILURES) {
        console.error('[Peaches] Too many consecutive heartbeat failures — DB may be down. Exiting to allow restart.');
        active = false;
        stopInstanceHeartbeat();
        client.destroy();
        setTimeout(() => process.exit(1), 1000);
      }
    }
  }, 5000);
}

export function stopInstanceHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/** Fast synchronous check — used in hot paths like the message handler. */
export function isBotActive(): boolean {
  return active;
}
