// Idempotent upgrade of a database created with `db:push` (schema v3) to the
// committed drizzle baseline, then records that baseline as applied so that
// `db:migrate` owns every schema change from here on.
//
// Safe to run repeatedly. Runs through tsx because it reuses the app's token
// encryption: feed tokens are moved from plaintext to hash + ciphertext.
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { encryptToken, isTokenCryptoConfigured } from "../src/integrations/token-crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const migrationsDir = new URL("../src/db/migrations/", import.meta.url);
const journal = JSON.parse(
  readFileSync(new URL("meta/_journal.json", migrationsDir), "utf8"),
) as { entries: { idx: number; when: number; tag: string }[] };
const baseline = journal.entries.find((e) => e.idx === 0);
if (!baseline) {
  console.error("No baseline migration in the drizzle journal");
  process.exit(1);
}
const baselineSql = readFileSync(new URL(`${baseline.tag}.sql`, migrationsDir), "utf8");
// Same hash drizzle's migrator stores for a migration file.
const baselineHash = createHash("sha256").update(baselineSql).digest("hex");

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });

async function columnExists(tx: postgres.TransactionSql, table: string, column: string) {
  const rows = await tx`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}`;
  return rows.length > 0;
}

try {
  await sql.begin(async (tx) => {
    const [{ exists: hasUsers }] = await tx<{ exists: boolean }[]>`
      SELECT to_regclass('public.users') IS NOT NULL AS exists`;
    if (!hasUsers) {
      throw new Error("Empty database: run `pnpm --filter @fenced/api db:migrate` instead");
    }

    // Schema v3, repeated so a database that skipped it still lands on the baseline.
    await tx`ALTER TABLE users DROP COLUMN IF EXISTS birth_month`;
    await tx`ALTER TABLE users DROP COLUMN IF EXISTS birth_year`;
    await tx`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb`;
    await tx`ALTER TABLE fenced_hours ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Fenced hour'`;
    await tx`ALTER TABLE fenced_hours ADD COLUMN IF NOT EXISTS skipped_dates jsonb NOT NULL DEFAULT '[]'::jsonb`;

    await tx`ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS lease_until timestamp with time zone`;
    await tx`ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS leased_by text`;

    await tx`ALTER TABLE consent_events ADD COLUMN IF NOT EXISTS vendor_ref text`;
    await tx`CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_events_vendor_ref ON consent_events USING btree (vendor_ref)`;

    await tx`CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks USING btree (user_id, updated_at)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_tasks_user_due_open ON tasks USING btree (user_id, due_at, completed_at)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_sessions_user_fence ON sessions USING btree (user_id, fence_id)`;

    // Feed URLs are the credential, so the plaintext column goes away. Existing
    // subscriptions keep working because the hash is of the same token.
    await tx`ALTER TABLE calendar_feeds ADD COLUMN IF NOT EXISTS token_hash text`;
    await tx`ALTER TABLE calendar_feeds ADD COLUMN IF NOT EXISTS token_enc text`;
    if (await columnExists(tx, "calendar_feeds", "token")) {
      await tx`
        UPDATE calendar_feeds
        SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
        WHERE token_hash IS NULL`;

      const pending = await tx<{ id: string; token: string }[]>`
        SELECT id, token FROM calendar_feeds WHERE token_enc IS NULL`;
      if (pending.length > 0) {
        // Without the ciphertext the app can no longer show a user their
        // existing feed URL, so refuse rather than strand them.
        if (!isTokenCryptoConfigured()) {
          throw new Error(
            `CALENDAR_TOKEN_KEY must be set to migrate ${pending.length} calendar feed token(s)`,
          );
        }
        for (const row of pending) {
          await tx`UPDATE calendar_feeds SET token_enc = ${encryptToken(row.token)} WHERE id = ${row.id}`;
        }
      }

      await tx`DROP INDEX IF EXISTS uq_calendar_feed_token`;
      await tx`ALTER TABLE calendar_feeds DROP COLUMN token`;
    }
    await tx`ALTER TABLE calendar_feeds ALTER COLUMN token_hash SET NOT NULL`;
    await tx`CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_feed_token_hash ON calendar_feeds USING btree (token_hash)`;

    await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await tx`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`;
    const recorded = await tx`
      SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = ${baseline.when}`;
    if (recorded.length === 0) {
      await tx`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${baselineHash}, ${baseline.when})`;
    }
  });
  console.log(`schema v4 ready; baseline ${baseline.tag} marked as applied`);
} finally {
  await sql.end({ timeout: 5 });
}
