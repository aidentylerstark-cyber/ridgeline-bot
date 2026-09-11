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

const INTERNAL_SUFFIX = ".railway.internal";

/** How long to wait for Railway's private network before giving up on it. */
const PRIVATE_DNS_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function mask(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isDnsFailure(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "ENOTFOUND" || code === "EAI_AGAIN";
}

function railwayContext(): string {
  return `project=${process.env.RAILWAY_PROJECT_NAME ?? "(unset)"} ` +
    `environment=${process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT ?? "(unset)"} ` +
    `service=${process.env.RAILWAY_SERVICE_NAME ?? "(unset)"}`;
}

/** Resolve a hostname, retrying with backoff until the deadline. */
async function waitForDns(host: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      await dns.promises.lookup(host);
      if (attempt > 1) console.log(`[Avery] Resolved ${host} after ${attempt} attempts`);
      return true;
    } catch (err) {
      if (!isDnsFailure(err)) throw err;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const delay = Math.min(5000, 500 * 2 ** (attempt - 1), remaining);
      console.warn(`[Avery] Private network not up — ${host} not resolving; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
      await sleep(delay);
    }
  }

  return false;
}

/**
 * Pick the connection string to use.
 *
 * Prefer DATABASE_URL. When it points at Railway's private network we give that
 * network a chance to come up first — it is not ready the instant the container
 * starts. If it never resolves, the private hostname is unreachable from this
 * service for a reason no retry can fix (different project, different environment,
 * private networking disabled, or a renamed Postgres service), so fall back to
 * DATABASE_PUBLIC_URL when one is configured. The public proxy costs egress, so it
 * is strictly a fallback — never the first choice.
 */
async function resolveConnectionString(): Promise<string | undefined> {
  const primary = process.env.DATABASE_URL;
  const fallback = process.env.DATABASE_PUBLIC_URL;

  if (!primary) {
    if (fallback) {
      console.warn("[Avery] DATABASE_URL is not set — using DATABASE_PUBLIC_URL");
      return fallback;
    }
    console.error("DATABASE_URL is not set!");
    return undefined;
  }

  const host = hostnameOf(primary);
  if (!host || !host.endsWith(INTERNAL_SUFFIX)) return primary;

  if (await waitForDns(host, PRIVATE_DNS_TIMEOUT_MS)) return primary;

  console.error(`[Avery] Railway context — ${railwayContext()}`);
  console.error(
    `[Avery] Could not resolve "${host}" after ${Math.round(PRIVATE_DNS_TIMEOUT_MS / 1000)}s. ` +
    "That hostname only exists on Railway's private network, and no amount of retrying " +
    "will create it. Check that the bot and Postgres are in the same project AND the same " +
    "environment, that private networking is enabled on this service, and that DATABASE_URL " +
    "is a reference variable (${{Postgres.DATABASE_URL}}) rather than a pasted literal."
  );

  if (fallback) {
    console.warn("[Avery] Falling back to DATABASE_PUBLIC_URL (public proxy — costs egress, fix private networking when you can)");
    return fallback;
  }

  console.error(
    "[Avery] No DATABASE_PUBLIC_URL is set, so there is nothing to fall back to. " +
    "Enable the TCP proxy on the Postgres service and add DATABASE_PUBLIC_URL " +
    "(${{Postgres.DATABASE_PUBLIC_URL}}) to this service to keep the bot online."
  );
  return primary;
}

const connectionString = await resolveConnectionString();

if (connectionString) {
  console.log("Database URL configured:", mask(connectionString));
}

const activeHost = connectionString ? hostnameOf(connectionString) : null;
const isInternalHost = activeHost !== null && activeHost.endsWith(INTERNAL_SUFFIX);
const isProduction = process.env.RAILWAY_ENVIRONMENT === "production" || process.env.NODE_ENV === "production";

// Create PostgreSQL connection pool. The public proxy always needs TLS; the private
// network does not, but Railway's Postgres accepts it, so keep the existing behaviour
// of enabling it in production either way.
const pool = new Pool({
  connectionString,
  ssl: (isProduction || !isInternalHost) ? { rejectUnauthorized: false } : undefined,
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

/**
 * Wait until the database actually answers a query.
 *
 * DNS resolving is not the same as Postgres being ready to serve — the server may
 * still be starting. Both startup paths await this before running migrations.
 */
export async function waitForDatabase(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt++;
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) console.log(`[Avery] Database reachable after ${attempt} attempts`);
      return;
    } catch (err) {
      lastError = err;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const delay = Math.min(5000, 500 * 2 ** (attempt - 1), remaining);
      const reason = isDnsFailure(err) ? `DNS not resolving (${activeHost})` : String((err as Error)?.message ?? err);
      console.warn(`[Avery] Database not ready — ${reason}; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
      await sleep(delay);
    }
  }

  console.error(`[Avery] Railway context — ${railwayContext()}`);
  throw lastError;
}
