import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

// Log database URL (masked) for debugging
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const masked = dbUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  console.log("Database URL configured:", masked);
} else {
  console.error("DATABASE_URL is not set!");
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Export pool for direct queries
export { pool };
