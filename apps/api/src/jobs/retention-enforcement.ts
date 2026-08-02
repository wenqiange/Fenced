import { lt, isNotNull, and } from "drizzle-orm";
import { db } from "../db";
import { consentEvents } from "../db/schema";

const RETENTION_WINDOW_DAYS = 30;

export async function processRetentionEnforcement() {
  const cutoff = new Date(Date.now() - RETENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Purge revoked consent events older than retention cutoff (30 days)
  const purgedConsent = await db
    .delete(consentEvents)
    .where(
      and(
        isNotNull(consentEvents.revokedAt),
        lt(consentEvents.revokedAt, cutoff)
      )
    )
    .returning();

  return {
    retentionWindowDays: RETENTION_WINDOW_DAYS,
    purgedRevokedConsents: purgedConsent.length,
    enforcedAt: new Date().toISOString(),
  };
}
