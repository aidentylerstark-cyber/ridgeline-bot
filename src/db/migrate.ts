import { pool } from "./index.js";
import * as fs from "fs";
import * as path from "path";
import type { PoolClient } from "pg";

/**
 * One-time migration: seed discord bot tables from JSON files if they exist
 * and the tables are empty. Safe to run multiple times.
 */
async function migrateJsonData(client: PoolClient): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");

  // Migrate tickets
  try {
    const ticketCount = await client.query("SELECT COUNT(*) FROM discord_tickets");
    if (parseInt(ticketCount.rows[0].count) === 0) {
      const ticketFile = path.join(dataDir, "tickets.json");
      if (fs.existsSync(ticketFile)) {
        const data = JSON.parse(fs.readFileSync(ticketFile, "utf-8"));
        const nextNum = data.nextTicketNumber ?? 1;

        // Update counter
        await client.query(
          `UPDATE site_content SET value = $1 WHERE key = 'discord_bot_state'`,
          [JSON.stringify({ nextTicketNumber: nextNum })]
        );

        // Insert open tickets
        const tickets = data.openTickets ?? {};
        for (const ticket of Object.values(tickets) as Array<Record<string, unknown>>) {
          await client.query(
            `INSERT INTO discord_tickets (ticket_number, department, discord_user_id, user_name, sl_name, subject, channel_id, claimed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (channel_id) DO NOTHING`,
            [
              ticket.ticketNumber,
              ticket.department,
              ticket.userId,
              ticket.userName,
              ticket.slName ?? null,
              ticket.subject,
              ticket.channelId,
              ticket.claimedBy ?? null,
              ticket.createdAt ? new Date(ticket.createdAt as string) : new Date(),
            ]
          );
        }
        console.log(`[Migration] Migrated ${Object.keys(tickets).length} tickets from JSON`);
      }
    }
  } catch (err) {
    console.error("[Migration] Ticket migration failed (non-fatal):", err);
  }

  // Migrate birthdays
  try {
    const bdayCount = await client.query("SELECT COUNT(*) FROM discord_birthdays");
    if (parseInt(bdayCount.rows[0].count) === 0) {
      const bdayFile = path.join(dataDir, "birthdays.json");
      if (fs.existsSync(bdayFile)) {
        const data = JSON.parse(fs.readFileSync(bdayFile, "utf-8"));
        let count = 0;
        for (const [userId, entry] of Object.entries(data) as Array<[string, Record<string, unknown>]>) {
          await client.query(
            `INSERT INTO discord_birthdays (discord_user_id, month, day, character_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (discord_user_id) DO NOTHING`,
            [userId, entry.month, entry.day, entry.characterName ?? null]
          );
          count++;
        }
        console.log(`[Migration] Migrated ${count} birthdays from JSON`);
      }
    }
  } catch (err) {
    console.error("[Migration] Birthday migration failed (non-fatal):", err);
  }

  // Migrate kudos
  try {
    const kudosCount = await client.query("SELECT COUNT(*) FROM discord_kudos");
    if (parseInt(kudosCount.rows[0].count) === 0) {
      const kudosFile = path.join(dataDir, "kudos.json");
      if (fs.existsSync(kudosFile)) {
        const data = JSON.parse(fs.readFileSync(kudosFile, "utf-8"));
        let count = 0;
        for (const [recipientId, entry] of Object.entries(data) as Array<[string, Record<string, unknown>]>) {
          const history = (entry.history ?? []) as Array<Record<string, unknown>>;
          for (const h of history) {
            await client.query(
              `INSERT INTO discord_kudos (recipient_discord_id, giver_discord_id, reason, created_at)
               VALUES ($1, $2, $3, $4)`,
              [recipientId, h.fromUserId, h.reason, h.timestamp ? new Date(h.timestamp as string) : new Date()]
            );
            count++;
          }
        }
        console.log(`[Migration] Migrated ${count} kudos entries from JSON`);
      }
    }
  } catch (err) {
    console.error("[Migration] Kudos migration failed (non-fatal):", err);
  }
}

/**
 * Run Discord bot database migrations: create tables and seed initial data.
 * Safe to run multiple times (all statements use IF NOT EXISTS / ON CONFLICT).
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure site_content table exists (shared with web app, needed for bot state)
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER
      )
    `);

    // Discord Bot Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number INTEGER NOT NULL,
        department VARCHAR(50) NOT NULL,
        discord_user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(200) NOT NULL,
        sl_name VARCHAR(100),
        subject VARCHAR(500) NOT NULL,
        channel_id VARCHAR(30) NOT NULL UNIQUE,
        claimed_by VARCHAR(30),
        is_closed BOOLEAN NOT NULL DEFAULT false,
        closed_by VARCHAR(30),
        closed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_tickets_open
        ON discord_tickets (channel_id) WHERE NOT is_closed
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_tickets_user_dept
        ON discord_tickets (discord_user_id, department) WHERE NOT is_closed
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_birthdays (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL UNIQUE,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        character_name VARCHAR(200),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Index for daily birthday lookups (month + day)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_birthdays_month_day
        ON discord_birthdays (month, day)
    `);

    // Index for ticket cleanup queries on closed_at
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_tickets_closed_at
        ON discord_tickets (closed_at) WHERE is_closed = true
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_kudos (
        id SERIAL PRIMARY KEY,
        recipient_discord_id VARCHAR(30) NOT NULL,
        giver_discord_id VARCHAR(30) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_kudos_recipient
        ON discord_kudos (recipient_discord_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_kudos_giver_date
        ON discord_kudos (giver_discord_id, created_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_member_xp (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL UNIQUE,
        total_xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        message_count INTEGER NOT NULL DEFAULT 0,
        last_xp_awarded_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Streak columns for XP system
    await client.query(`
      ALTER TABLE discord_member_xp ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE discord_member_xp ADD COLUMN IF NOT EXISTS last_streak_date VARCHAR(10)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_member_xp_user
      ON discord_member_xp (discord_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_member_xp_leaderboard
      ON discord_member_xp (total_xp DESC)
    `);

    // Suggestions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_suggestions (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        content TEXT NOT NULL,
        message_id VARCHAR(30),
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        reviewed_by VARCHAR(30),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_suggestions_user
        ON discord_suggestions (discord_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_suggestions_message
        ON discord_suggestions (message_id) WHERE message_id IS NOT NULL
    `);

    // Starboard table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_starboard (
        id SERIAL PRIMARY KEY,
        source_message_id VARCHAR(30) NOT NULL UNIQUE,
        starboard_message_id VARCHAR(30),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Warnings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_warnings (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        giver_discord_id VARCHAR(30) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_warnings_user
        ON discord_warnings (discord_user_id)
    `);

    // Dedup tables — prevent double milestone/birthday posts after restarts
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_milestone_posts (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        milestone_days INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (discord_user_id, milestone_days)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_birthday_posts (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (discord_user_id, year)
      )
    `);

    // Scheduled role removals — persistent timers for role expiry
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_scheduled_role_removals (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        role_name VARCHAR(100) NOT NULL,
        remove_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (discord_user_id, role_name)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_role_removals_due
        ON discord_scheduled_role_removals (remove_at)
    `);

    // Audit Log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_audit_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        actor_discord_id VARCHAR(30) NOT NULL,
        target_discord_id VARCHAR(30),
        details TEXT NOT NULL,
        channel_id VARCHAR(30),
        reference_id VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_audit_log_action
        ON discord_audit_log (action)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_audit_log_actor
        ON discord_audit_log (actor_discord_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_audit_log_target
        ON discord_audit_log (target_discord_id) WHERE target_discord_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_audit_log_created
        ON discord_audit_log (created_at DESC)
    `);

    // Region monitoring snapshots
    await client.query(`
      CREATE TABLE IF NOT EXISTS region_snapshots (
        id SERIAL PRIMARY KEY,
        region_name VARCHAR(100) NOT NULL,
        agent_count INTEGER NOT NULL DEFAULT 0,
        agents JSONB NOT NULL DEFAULT '[]',
        fps INTEGER,
        dilation VARCHAR(10),
        event_type VARCHAR(20) NOT NULL DEFAULT 'status',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_region_snapshots_region_created
        ON region_snapshots (region_name, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_region_snapshots_created
        ON region_snapshots (created_at DESC)
    `);

    // Timecards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_timecards (
        id SERIAL PRIMARY KEY,
        discord_user_id VARCHAR(30) NOT NULL,
        department VARCHAR(30) NOT NULL,
        clock_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
        clock_out_at TIMESTAMP,
        total_minutes INTEGER,
        auto_clock_out BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_timecards_user_open
        ON discord_timecards (discord_user_id) WHERE clock_out_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_timecards_dept_date
        ON discord_timecards (department, clock_in_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_timecards_stale
        ON discord_timecards (clock_in_at) WHERE clock_out_at IS NULL
    `);

    // Seed ticket counter in site_content if not present
    await client.query(`
      INSERT INTO site_content (key, value) VALUES ('discord_bot_state', '{"nextTicketNumber": 1}')
      ON CONFLICT (key) DO NOTHING
    `);

    // One-time migration: seed from JSON files if tables are empty
    await migrateJsonData(client);

    await client.query("COMMIT");
    console.log("Database migrations completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}
