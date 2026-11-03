import { router } from "../init";
import { sessionRouter } from "./session";
import { taskRouter } from "./task";
import { fenceRouter } from "./fence";
import { userRouter } from "./user";
import { calendarRouter } from "./calendar";
import { calendarSyncRouter } from "./calendar-sync";
import { fencedHoursRouter } from "./fenced-hours";
import { aiRouter } from "./ai";
import { projectRouter } from "./project";

export const appRouter = router({
  user: userRouter,
  session: sessionRouter,
  task: taskRouter,
  project: projectRouter,
  fence: fenceRouter,
  calendar: calendarRouter,
  calendarSync: calendarSyncRouter,
  fencedHours: fencedHoursRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
