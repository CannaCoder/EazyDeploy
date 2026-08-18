import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, conflictChecks, projects } from "@shipora/db";
import { eq, and, desc } from "drizzle-orm";
import { startConflictGuardWorkflow } from "../../plugins/temporal.js";

export const conflictChecksRouter = router({
  list: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      try {
        const rows = await db
          .select()
          .from(conflictChecks)
          .where(eq(conflictChecks.projectId, input.projectId))
          .orderBy(desc(conflictChecks.createdAt))
          .limit(50);

        return rows;
      } catch {
        return [];
      }
    }),

  getByCommit: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        commitSha: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const rows = await db
          .select()
          .from(conflictChecks)
          .where(
            and(
              eq(conflictChecks.projectId, input.projectId),
              eq(conflictChecks.commitSha, input.commitSha)
            )
          )
          .orderBy(desc(conflictChecks.createdAt))
          .limit(1);

        return rows[0] || null;
      } catch {
        return null;
      }
    }),

  retry: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        commitSha: z.string(),
        branch: z.string().default("main"),
      })
    )
    .mutation(async ({ input }) => {
      // Find project details
      let project;
      try {
        const pRows = await db
          .select()
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1);
        project = pRows[0];
      } catch {
        // mock fallback
      }

      const repoOwner = project?.githubRepoOwner || "owner";
      const repoName = project?.githubRepoName || "repo";
      const installationId = project?.githubInstallationId || 123456;

      // Insert new running check record
      let checkId = "mock-check-id";
      try {
        const inserted = await db
          .insert(conflictChecks)
          .values({
            projectId: input.projectId,
            commitSha: input.commitSha,
            branch: input.branch,
            status: "running",
            mergeConflicts: false,
            lockfileHealthy: true,
            envVarsValid: true,
          })
          .returning();
        if (inserted[0]) {
          checkId = inserted[0].id;
        }
      } catch {
        // ignore
      }

      // Dispatch Temporal workflow
      const workflowResult = await startConflictGuardWorkflow({
        projectId: input.projectId,
        repoOwner,
        repoName,
        commitSha: input.commitSha,
        branch: input.branch,
        installationId,
      });

      return {
        checkId,
        workflowId: workflowResult?.workflowId,
        status: "running",
      };
    }),
});
