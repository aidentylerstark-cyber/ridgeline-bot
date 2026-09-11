import dns from "node:dns";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

// Railway's private network (*.railway.internal) is IPv6-only — those hostnames
// publish AAAA records and nothing else, so resolution must not drop the AAAA answer.
//
// "ipv6first" only exists on Node >= 20.13; Railway runs Node 18, which throws
// ERR_INVALID_ARG_VALUE on it and takes the whole process down at import time. Fall
// back to "verbatim" (the default since Node 17), which returns records in the order
// DNS gave them and is sufficient here — a host with only AAAA records has exactly
// one answer to return.
try {
  dns.setDefaultResultOrder("ipv6first");
} catch {
  dns.setDefaultResultOrder("verbatim");
}

// Log database URL (masked) for debugging
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const masked = dbUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  console.log("Database URL configured:", masked);
} else {
  console.error("DATABASE_URL is not set!");
}

function dbHostname(): string | null {
  if (!dbUrl) return null;
  try {
    return new URL(dbUrl).hostname;
  } catch {
    return null;
  }
}

const dbHost = dbHostname();
const isInternalHost = dbHost !== null && dbHost.endsWith(".railway.internal");

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: dbUrl,
  ssl: (process.env.RAILWAY_ENVIRONMENT === "production" || process.env.NODE_ENV === "production") ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("[Discord Bot] Unexpected PostgreSQL pool error:", err);
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Export pool for direct queries
export { pool };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function isDnsFailure(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "ENOTFOUND" || code === "EAI_AGAIN";
}

/**
 * Wait until the database is actually reachable.
 *
 * Railway's private network is not up the instant the container starts — DNS for
 * `postgres.railway.internal` fails for the first few seconds. The migration ran as
 * the very first thing on boot, hit that window, and exited 1; the restart policy
 * then burned its retries on fresh containers that raced the same gap, so the deploy
 * stayed down. Blocking here until a real query succeeds closes that window.
 *
 * Returns once `SELECT 1` succeeds. Throws the last error if the deadline passes.
 */
export async function waitForDatabase(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt++;
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) {
        console.log(`[Avery] Database reachable after ${attempt} attempts`);
      }
      return;
    } catch (err) {
      lastError = err;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const delay = Math.min(5000, 500 * 2 ** (attempt - 1), remaining);
      const reason = isDnsFailure(err) ? `DNS not resolving (${dbHost})` : String((err as Error)?.message ?? err);
      console.warn(`[Avery] Database not ready — ${reason}; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
      await sleep(delay);
    }
  }

  if (isDnsFailure(lastError)) {
    // Print where Railway thinks this container lives. Private DNS only works between
    // services in the SAME project and the SAME environment, so these three values are
    // what you compare against the Postgres service to find a mismatch.
    console.error(
      "[Avery] Railway context — project=%s environment=%s service=%s",
      process.env.RAILWAY_PROJECT_NAME ?? "(unset)",
      process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT ?? "(unset)",
      process.env.RAILWAY_SERVICE_NAME ?? "(unset)"
    );
    console.error(
      `[Avery] Could not resolve "${dbHost}" after ${Math.round(timeoutMs / 1000)}s. ` +
      (isInternalHost
        ? "That hostname only exists on Railway's private network. Check that: " +
          "(1) the Postgres service still exists and is named so its host matches, " +
          "(2) DATABASE_URL is a reference variable (${{Postgres.DATABASE_URL}}) and not a pasted literal, " +
          "(3) the bot and Postgres are in the same project AND environment. " +
          "As a workaround, set DATABASE_URL to the value of DATABASE_PUBLIC_URL."
        : "Check that the database host is correct and reachable from this network.")
    );
  }

  throw lastError;
}
