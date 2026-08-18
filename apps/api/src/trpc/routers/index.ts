import { router } from "../trpc.js";
import { userRouter } from "./user.js";
import { projectRouter } from "./project.js";
import { conflictChecksRouter } from "./conflict-checks.js";
import { deploymentRouter } from "./deployment.js";

export const appRouter = router({
  user: userRouter,
  project: projectRouter,
  conflictCheck: conflictChecksRouter,
  deployment: deploymentRouter,
});

export type AppRouter = typeof appRouter;
