import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { summarizeCirclePresence, type CoFocusCircle, type CoFocusMember } from "@fenced/core";
import { router, authedProcedure } from "../init";
import { coFocusCircles, circleMembers, users } from "../../db/schema";

function randomInviteCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TIMBER-${suffix}`;
}

export const circleRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.circleMembers.findMany({
      where: eq(circleMembers.userId, ctx.userId),
    });

    if (memberships.length === 0) return [];

    const circleIds = memberships.map((m) => m.circleId);
    const circles = await ctx.db.query.coFocusCircles.findMany({
      where: inArray(coFocusCircles.id, circleIds),
      with: {
        members: true,
      },
    });

    return circles.map((c) => {
      const coreCircle: CoFocusCircle = {
        id: c.id,
        name: c.name,
        inviteCode: c.inviteCode,
        circleFocusMinutes: c.circleFocusMinutes,
        activeSessionEndsAt: null,
        members: c.members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarSeed: m.avatarSeed,
          isFocusing: m.isFocusing,
          currentSubject: m.currentSubject ?? undefined,
          joinedAt: m.joinedAt.toISOString(),
        })),
      };

      const summary = summarizeCirclePresence(coreCircle);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        inviteCode: c.inviteCode,
        circleFocusMinutes: c.circleFocusMinutes,
        activeCount: summary.activeCount,
        totalMembers: summary.totalMembers,
        focusingSubjects: summary.focusingSubjects,
        createdAt: c.createdAt,
      };
    });
  }),

  get: authedProcedure
    .input(z.object({ circleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const circle = await ctx.db.query.coFocusCircles.findFirst({
        where: eq(coFocusCircles.id, input.circleId),
        with: {
          members: true,
        },
      });

      if (!circle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Study room not found" });
      }

      // Minor-safe: zero DM vectors, no email, no device details
      const safeMembers: CoFocusMember[] = circle.members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        avatarSeed: m.avatarSeed,
        isFocusing: m.isFocusing,
        currentSubject: m.currentSubject ?? undefined,
        joinedAt: m.joinedAt.toISOString(),
      }));

      const coreCircle: CoFocusCircle = {
        id: circle.id,
        name: circle.name,
        inviteCode: circle.inviteCode,
        circleFocusMinutes: circle.circleFocusMinutes,
        activeSessionEndsAt: null,
        members: safeMembers,
      };

      const summary = summarizeCirclePresence(coreCircle);

      return {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        inviteCode: circle.inviteCode,
        circleFocusMinutes: circle.circleFocusMinutes,
        isCreator: circle.creatorUserId === ctx.userId,
        members: circle.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          displayName: m.displayName,
          avatarSeed: m.avatarSeed,
          isFocusing: m.isFocusing,
          currentSubject: m.currentSubject,
          activeSessionEndsAt: m.activeSessionEndsAt?.toISOString() ?? null,
          isSelf: m.userId === ctx.userId,
        })),
        summary,
      };
    }),

  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(64),
        description: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let inviteCode = randomInviteCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await ctx.db.query.coFocusCircles.findFirst({
          where: eq(coFocusCircles.inviteCode, inviteCode),
        });
        if (!existing) break;
        inviteCode = randomInviteCode();
      }

      const [circle] = await ctx.db
        .insert(coFocusCircles)
        .values({
          creatorUserId: ctx.userId,
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          inviteCode,
        })
        .returning();

      await ctx.db.insert(circleMembers).values({
        circleId: circle.id,
        userId: ctx.userId,
        displayName: user.displayName || "Scholar",
        avatarSeed: user.id.slice(0, 8),
        isFocusing: false,
      });

      return circle;
    }),

  join: authedProcedure
    .input(z.object({ inviteCode: z.string().min(3).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.inviteCode.trim().toUpperCase();
      const circle = await ctx.db.query.coFocusCircles.findFirst({
        where: eq(coFocusCircles.inviteCode, code),
      });

      if (!circle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      }

      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const existingMember = await ctx.db.query.circleMembers.findFirst({
        where: and(
          eq(circleMembers.circleId, circle.id),
          eq(circleMembers.userId, ctx.userId)
        ),
      });

      if (!existingMember) {
        await ctx.db.insert(circleMembers).values({
          circleId: circle.id,
          userId: ctx.userId,
          displayName: user.displayName || "Scholar",
          avatarSeed: user.id.slice(0, 8),
          isFocusing: false,
        });
      }

      return circle;
    }),

  leave: authedProcedure
    .input(z.object({ circleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(circleMembers)
        .where(
          and(
            eq(circleMembers.circleId, input.circleId),
            eq(circleMembers.userId, ctx.userId)
          )
        );

      return { success: true };
    }),

  setPresence: authedProcedure
    .input(
      z.object({
        circleId: z.string().uuid(),
        isFocusing: z.boolean(),
        currentSubject: z.string().max(40).optional(),
        durationMinutes: z.number().int().min(1).max(240).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const endsAt =
        input.isFocusing && input.durationMinutes
          ? new Date(now.getTime() + input.durationMinutes * 60_000)
          : null;

      await ctx.db
        .update(circleMembers)
        .set({
          isFocusing: input.isFocusing,
          currentSubject: input.currentSubject ?? null,
          activeSessionEndsAt: endsAt,
          lastHeartbeatAt: now,
        })
        .where(
          and(
            eq(circleMembers.circleId, input.circleId),
            eq(circleMembers.userId, ctx.userId)
          )
        );

      if (!input.isFocusing && input.durationMinutes) {
        await ctx.db
          .update(coFocusCircles)
          .set({
            circleFocusMinutes: sql`${coFocusCircles.circleFocusMinutes} + ${input.durationMinutes}`,
            updatedAt: now,
          })
          .where(eq(coFocusCircles.id, input.circleId));
      }

      return { success: true };
    }),
});
