import { desc, eq } from "drizzle-orm";
import type { Database } from "./db";
import { consentEvents } from "./db/schema";

export interface ConsentEventState {
  id: string;
  grantedAt: Date | null;
  revokedAt: Date | null;
  scope?: string;
}

/**
 * Consent is append-only: a revocation is a new row, it never edits the grant.
 * So only the most recent event decides whether consent currently holds.
 */
export function isConsentActive(latest: ConsentEventState | undefined): boolean {
  return Boolean(latest?.grantedAt && !latest.revokedAt);
}

/** The user's most recent consent event if it is an unrevoked grant, else `null`. */
export async function activeConsent(
  db: Database,
  userId: string,
): Promise<ConsentEventState | null> {
  const [latest] = await db
    .select({
      id: consentEvents.id,
      grantedAt: consentEvents.grantedAt,
      revokedAt: consentEvents.revokedAt,
      scope: consentEvents.scope,
    })
    .from(consentEvents)
    .where(eq(consentEvents.userId, userId))
    .orderBy(desc(consentEvents.createdAt))
    .limit(1);
  return isConsentActive(latest) ? latest : null;
}
