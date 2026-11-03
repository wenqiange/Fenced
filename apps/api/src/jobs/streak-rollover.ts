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
    UPDATE streaks AS s
    SET current_streak = 0, updated_at = now()
    FROM users AS u
    WHERE u.id = s.user_id
      AND s.current_streak > 0
      AND s.last_session_date IS NOT NULL
      AND s.last_session_date::date < (
        (now() AT TIME ZONE (
          CASE WHEN u.timezone IN (SELECT name FROM pg_timezone_names)
               THEN u.timezone ELSE 'UTC' END
        ))::date - 1
      )
    RETURNING s.user_id
  `);
  const [{ total }] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM streaks`,
  );
  return { processedUsers: reset.length, totalUsers: total };
}
