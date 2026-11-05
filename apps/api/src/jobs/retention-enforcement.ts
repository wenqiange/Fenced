import { lt, isNotNull, and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  consentEvents,
  tasks,
  taskDependencies,
  sessions,
  fencedHours,
  fences,
  projects,
  calendarEvents,
  calendarConnections,
  calendarSyncTombstones,
  calendarFeeds,
  streaks,
} from "../db/schema";
import { isConsentActive } from "../consent";

const RETENTION_WINDOW_DAYS = 30;

export async function processRetentionEnforcement() {
  const cutoff = new Date(Date.now() - RETENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Find all users who have at least one revoked consent event older than the cutoff.
  // We NEVER delete rows from consentEvents: it is an append-only legal audit log.
  // Instead, if the user's latest consent remains revoked after 30 days, we purge their synced data.
  const revokedCandidates = await db
    .select({ userId: consentEvents.userId })
    .from(consentEvents)
    .where(
      and(
        isNotNull(consentEvents.revokedAt),
        lt(consentEvents.revokedAt, cutoff)
      )
    );

  const uniqueUserIds = [...new Set(revokedCandidates.map((r) => r.userId))];
  let purgedUsersCount = 0;

  for (const userId of uniqueUserIds) {
    // Check user's most recent consent event
    const [latestEvent] = await db
      .select({
        id: consentEvents.id,
        grantedAt: consentEvents.grantedAt,
        revokedAt: consentEvents.revokedAt,
      })
      .from(consentEvents)
      .where(eq(consentEvents.userId, userId))
      .orderBy(desc(consentEvents.createdAt))
      .limit(1);

    // If active consent exists or the latest revocation is still within 30 days, skip
    if (isConsentActive(latestEvent)) continue;
    if (latestEvent?.revokedAt && latestEvent.revokedAt >= cutoff) continue;

    // Purge user's personal synced data in an atomic transaction
    await db.transaction(async (tx) => {
      await tx.delete(taskDependencies).where(eq(taskDependencies.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(fencedHours).where(eq(fencedHours.userId, userId));
      await tx.delete(fences).where(eq(fences.userId, userId));
      await tx.delete(projects).where(eq(projects.userId, userId));
      await tx.delete(calendarEvents).where(eq(calendarEvents.userId, userId));
      await tx.delete(calendarSyncTombstones).where(eq(calendarSyncTombstones.userId, userId));
      await tx.delete(calendarConnections).where(eq(calendarConnections.userId, userId));
      await tx.delete(calendarFeeds).where(eq(calendarFeeds.userId, userId));
      await tx.delete(streaks).where(eq(streaks.userId, userId));

      // Anonymize user record to satisfy GDPR/COPPA right to erasure while retaining
      // the immutable consentEvents audit record
      await tx
        .update(users)
        .set({
          displayName: "Deleted User",
          email: null,
          intent: null,
          distractionCategories: [],
          onboardingCompleted: false,
          needsGuardianConsent: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });

    purgedUsersCount++;
  }

  return {
    retentionWindowDays: RETENTION_WINDOW_DAYS,
    purgedUsersCount,
    enforcedAt: new Date().toISOString(),
  };
}
