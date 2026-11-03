import type { Context as HonoContext } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export type AppVariables = {
  clerkId?: string;
  userId?: string;
  ageBand?: string;
  timezone?: string;
};

export async function createContext(c: HonoContext<{ Variables: AppVariables }>) {
  const clerkId = c.get("clerkId");
  let userId = c.get("userId");
  let ageBand = c.get("ageBand");
  let timezone = c.get("timezone") ?? "UTC";
  let needsGuardianConsent = false;

  if (clerkId && !userId) {
    try {
      const [user] = await db
        .select({
          id: users.id,
          ageBand: users.ageBand,
          timezone: users.timezone,
          needsGuardianConsent: users.needsGuardianConsent,
        })
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);
      if (user) {
        userId = user.id;
        ageBand = user.ageBand;
        timezone = user.timezone || "UTC";
        needsGuardianConsent = user.needsGuardianConsent;
      }
    } catch (err) {
      // DB may be unavailable in local scaffold; auth still carries clerkId.
      console.warn("[context] Failed to lookup user profile from DB:", err);
    }
  }

  return {
    db,
    clerkId,
    userId,
    ageBand,
    timezone,
    needsGuardianConsent,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
