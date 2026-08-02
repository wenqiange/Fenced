import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { calendarEvents } from "../../db/schema";

export const calendarRouter = router({
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        notes: z.string().optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        allDay: z.boolean().default(false),
        rrule: z.string().optional(),
        reminders: z.array(z.number().int()).default([]),
        linkedSessionId: z.string().uuid().optional(),
        linkedTaskId: z.string().uuid().optional(),
        source: z.enum(["local", "google", "outlook", "apple"]).default("local"),
        externalId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .insert(calendarEvents)
        .values({
          userId: ctx.userId,
          title: input.title,
          notes: input.notes,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          allDay: input.allDay,
          rrule: input.rrule,
          reminders: input.reminders,
          linkedSessionId: input.linkedSessionId,
          linkedTaskId: input.linkedTaskId,
          source: input.source,
          externalId: input.externalId,
        })
        .returning();
      return event;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        notes: z.string().nullable().optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        allDay: z.boolean().optional(),
        rrule: z.string().nullable().optional(),
        reminders: z.array(z.number().int()).optional(),
        linkedSessionId: z.string().uuid().nullable().optional(),
        linkedTaskId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, startAt, endAt, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (startAt) values.startAt = new Date(startAt);
      if (endAt) values.endAt = new Date(endAt);

      const [event] = await ctx.db
        .update(calendarEvents)
        .set(values)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, ctx.userId)))
        .returning();
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.id, input.id), eq(calendarEvents.userId, ctx.userId)))
        .returning();
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  list: authedProcedure
    .input(
      z.object({
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(calendarEvents.userId, ctx.userId)];
      if (input.startAt) conditions.push(gte(calendarEvents.startAt, new Date(input.startAt)));
      if (input.endAt) conditions.push(lte(calendarEvents.endAt, new Date(input.endAt)));

      return ctx.db.query.calendarEvents.findMany({
        where: and(...conditions),
        orderBy: (e, { asc }) => [asc(e.startAt)],
      });
    }),
});
