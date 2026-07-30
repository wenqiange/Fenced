import { router } from "../init";
import { sessionRouter } from "./session";
import { taskRouter } from "./task";
import { fenceRouter } from "./fence";
import { userRouter } from "./user";

export const appRouter = router({
  user: userRouter,
  session: sessionRouter,
  task: taskRouter,
  fence: fenceRouter,
});

export type AppRouter = typeof appRouter;
