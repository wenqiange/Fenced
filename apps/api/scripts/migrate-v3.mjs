// Idempotent schema upgrade for the local-first sync rework.
// Safe to run repeatedly: every statement is guarded with IF [NOT] EXISTS.
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20 });

try {
  await sql.begin(async (tx) => {
    // COPPA / GDPR-K data minimisation: birth month/year must never persist
    // server-side. Dropping the columns deletes every value ever stored.
    await tx`ALTER TABLE users DROP COLUMN IF EXISTS birth_month`;
    await tx`ALTER TABLE users DROP COLUMN IF EXISTS birth_year`;

    await tx`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb`;
    await tx`ALTER TABLE fenced_hours ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Fenced hour'`;
    await tx`ALTER TABLE fenced_hours ADD COLUMN IF NOT EXISTS skipped_dates jsonb NOT NULL DEFAULT '[]'::jsonb`;
  });
  console.log("schema v3 ready");
} finally {
  await sql.end({ timeout: 5 });
}
