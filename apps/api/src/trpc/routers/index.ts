import { router } from "../init";
import { sessionRouter } from "./session";
import { taskRouter } from "./task";
import { fenceRouter } from "./fence";
import { userRouter } from "./user";
import { calendarRouter } from "./calendar";
import { fencedHoursRouter } from "./fenced-hours";

export const appRouter = router({
  user: userRouter,
  session: sessionRouter,
  task: taskRouter,
  fence: fenceRouter,
  calendar: calendarRouter,
  fencedHours: fencedHoursRouter,
});

export type AppRouter = typeof appRouter;
