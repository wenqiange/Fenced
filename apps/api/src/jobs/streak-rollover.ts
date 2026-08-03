import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, streaks } from "../db/schema";

export async function processStreakRollover() {
  const allUsers = await db.select({ id: users.id, timezone: users.timezone }).from(users);
  let processed = 0;

  for (const user of allUsers) {
    // Calculate current date string in user's specified timezone (or UTC fallback)
    const userNow = new Date();
    let todayStr: string;
    try {
      todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(userNow);
    } catch {
      todayStr = userNow.toISOString().slice(0, 10);
    }

    const streak = await db.query.streaks.findFirst({
      where: eq(streaks.userId, user.id),
    });

    if (streak && streak.lastSessionDate) {
      const lastDate = new Date(streak.lastSessionDate);
      const currentDate = new Date(todayStr);
      const diffDays = Math.floor(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // If more than 1 day has passed without a completed session, reset current streak to 0
      if (diffDays > 1 && streak.currentStreak > 0) {
        await db
          .update(streaks)
          .set({
            currentStreak: 0,
            updatedAt: new Date(),
          })
          .where(eq(streaks.userId, user.id));
        processed++;
      }
    }
  }

  return { processedUsers: processed, totalUsers: allUsers.length };
}
