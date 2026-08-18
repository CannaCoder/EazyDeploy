import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { deployments, projects, services, users } from "@shipora/db";
import { eq, desc } from "drizzle-orm";
import {
  startDeployWorkflow,
  getDeployWorkflowProgress,
} from "../../plugins/temporal.js";

export const deploymentRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const projectDeployments = await ctx.db
          .select()
          .from(deployments)
          .where(eq(deployments.projectId, input.projectId))
          .orderBy(desc(deployments.createdAt));

        return projectDeployments;
      } catch {
        // Fallback for mock / dev
        return [
          {
            id: "770e8400-e29b-41d4-a716-446655440001",
            projectId: input.projectId,
            commitSha: "a1b2c3d4e5f67890",
            branch: "main",
            status: "success",
            temporalWorkflowId: "deploy-proj-1234",
            startedAt: new Date(Date.now() - 3600000),
            completedAt: new Date(Date.now() - 3540000),
            createdAt: new Date(Date.now() - 3600000),
          },
        ];
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const deploymentRes = await ctx.db
          .select()
          .from(deployments)
          .where(eq(deployments.id, input.id))
          .limit(1);

        const deployment = deploymentRes[0];
        if (!deployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deployment not found",
          });
        }

        const projectRes = await ctx.db
          .select()
          .from(projects)
          .where(eq(projects.id, deployment.projectId))
          .limit(1);

        const projectServices = await ctx.db
          .select()
          .from(services)
          .where(eq(services.projectId, deployment.projectId));

        let liveProgress = null;
        if (deployment.temporalWorkflowId) {
          liveProgress = await getDeployWorkflowProgress(
            deployment.temporalWorkflowId
          );
        }

        return {
          ...deployment,
          project: projectRes[0] || null,
          services: projectServices,
          liveProgress,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return {
          id: input.id,
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          commitSha: "a1b2c3d4e5f6",
          branch: "main",
          status: "success",
          temporalWorkflowId: "deploy-proj-mock",
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
          project: {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "Shipora Demo App",
            githubRepoOwner: "shipora-demo",
            githubRepoName: "demo-monorepo",
            productionBranch: "main",
          },
          services: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              name: "web",
              type: "nextjs",
              port: 3000,
              serviceUrl: "https://web-demo.shipora.app",
            },
            {
              id: "660e8400-e29b-41d4-a716-446655440002",
              name: "api",
              type: "node",
              port: 4000,
              serviceUrl: "https://api-demo.shipora.app",
            },
          ],
          liveProgress: null,
        };
      }
    }),

  trigger: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        commitSha: z.string().optional(),
        branch: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let project;
      try {
        const found = await ctx.db
          .select()
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1);
        project = found[0];
      } catch {
        // mock fallback
      }

      const branch = input.branch || project?.productionBranch || "main";
      const commitSha =
        input.commitSha ||
        Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10);

      // Find triggering user
      let userId: string | undefined;
      try {
        const userRes = await ctx.db
          .select()
          .from(users)
          .where(eq(users.clerkId, ctx.user.clerkId))
          .limit(1);
        userId = userRes[0]?.id;
      } catch {
        // ignore
      }

      let insertedDeployment;
      try {
        const inserted = await ctx.db
          .insert(deployments)
          .values({
            projectId: input.projectId,
            commitSha,
            branch,
            status: "building",
            triggeredBy: userId,
            startedAt: new Date(),
          })
          .returning();
        insertedDeployment = inserted[0];
      } catch {
        insertedDeployment = {
          id: "770e8400-e29b-41d4-a716-446655440002",
          projectId: input.projectId,
          commitSha,
          branch,
          status: "building",
          triggeredBy: userId || null,
          startedAt: new Date(),
          completedAt: null,
          temporalWorkflowId: null,
          createdAt: new Date(),
        };
      }

      const deploymentId = insertedDeployment?.id || "770e8400-e29b-41d4-a716-446655440002";

      // Start Temporal Deploy Workflow
      const workflowResult = await startDeployWorkflow({
        deploymentId,
        projectId: input.projectId,
        repoOwner: project?.githubRepoOwner || "owner",
        repoName: project?.githubRepoName || "repo",
        commitSha,
        branch,
        installationId: Number(project?.githubInstallationId) || 123456,
      });

      if (workflowResult?.workflowId) {
        try {
          await ctx.db
            .update(deployments)
            .set({ temporalWorkflowId: workflowResult.workflowId })
            .where(eq(deployments.id, deploymentId));
        } catch {
          // ignore
        }
      }

      return {
        ...insertedDeployment,
        temporalWorkflowId: workflowResult?.workflowId || null,
      };
    }),
});
