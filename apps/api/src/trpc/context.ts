import type { Context as HonoContext } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export type AppVariables = {
  clerkId?: string;
  userId?: string;
  ageBand?: string;
};

export async function createContext(c: HonoContext<{ Variables: AppVariables }>) {
  const clerkId = c.get("clerkId");
  let userId = c.get("userId");
  let ageBand = c.get("ageBand");

  if (clerkId && !userId) {
    try {
      const [user] = await db
        .select({
          id: users.id,
          ageBand: users.ageBand,
        })
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);
      if (user) {
        userId = user.id;
        ageBand = user.ageBand;
      }
    } catch {
      // DB may be unavailable in local scaffold; auth still carries clerkId.
    }
  }

  return {
    db,
    clerkId,
    userId,
    ageBand,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
