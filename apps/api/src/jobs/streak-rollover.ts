import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Resets streaks whose last session is more than one local day old.
 *
 * One set-based UPDATE instead of a query per user: the "local today" of each
 * user is computed in Postgres from their stored timezone. Unknown timezone
 * strings fall back to UTC so one bad row cannot fail the whole statement.
 */
export async function processStreakRollover() {
  const reset = await db.execute<{ user_id: string }>(sql`
    WITH active_zones AS (
      SELECT DISTINCT timezone FROM users WHERE timezone IS NOT NULL
    ),
    valid_zones AS (
      SELECT name FROM pg_timezone_names WHERE name IN (SELECT timezone FROM active_zones)
    )
    UPDATE streaks AS s
    SET current_streak = 0, updated_at = now()
    FROM users AS u
    LEFT JOIN valid_zones AS vz ON vz.name = u.timezone
    WHERE u.id = s.user_id
      AND s.current_streak > 0
      AND s.last_session_date IS NOT NULL
      AND s.last_session_date::date < (
        (now() AT TIME ZONE COALESCE(vz.name, 'UTC'))::date - 1
      )
    RETURNING s.user_id
  `);
  const [{ total }] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM streaks`,
  );
  return { processedUsers: reset.length, totalUsers: total };
}
