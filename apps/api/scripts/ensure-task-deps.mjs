import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE cascade,
      depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE cascade,
      created_at timestamptz DEFAULT now() NOT NULL
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_task_dependency ON task_dependencies (task_id, depends_on_task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies (task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_deps_blocker ON task_dependencies (depends_on_task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_deps_user ON task_dependencies (user_id)`;
  console.log("task_dependencies ready");
} finally {
  await sql.end({ timeout: 5 });
}
