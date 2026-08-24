import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@shipora/db";
import { deployments } from "@shipora/db";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/fastify";

/**
 * POST /deployments/:id/rollback
 *
 * Triggers a manual rollback for a completed or failed deployment.
 * The deployment must have previousRevisionRefs populated (set after
 * a successful ingress configuration in the deploy workflow).
 *
 * Returns: { rollbackDeploymentId }
 */
export async function rollbackRoutes(app: FastifyInstance) {
  app.post(
    "/deployments/:id/rollback",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = getAuth(request);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: deploymentId } = request.params;

      // ── Fetch the source deployment ────────────────────────────────────────
      let sourceDeployment: typeof deployments.$inferSelect | null = null;

      try {
        const rows = await db
          .select()
          .from(deployments)
          .where(eq(deployments.id, deploymentId))
          .limit(1);
        sourceDeployment = rows[0] ?? null;
      } catch (err) {
        return reply.status(500).send({ error: "Failed to fetch deployment" });
      }

      if (!sourceDeployment) {
        return reply.status(404).send({ error: "Deployment not found" });
      }

      const ROLLBACK_ELIGIBLE = new Set(["success", "failed", "rolled_back"]);
      if (!ROLLBACK_ELIGIBLE.has(sourceDeployment.status)) {
        return reply.status(400).send({
          error: `Cannot rollback a deployment with status '${sourceDeployment.status}'`,
        });
      }

      if (!sourceDeployment.previousRevisionRefs) {
        return reply.status(400).send({
          error:
            "This deployment has no previous revision references — it may be the first deploy or was deployed before Phase 4.",
        });
      }

      // ── Create a new tracking deployment record for the rollback ──────────
      let rollbackDeployment: { id: string } | null = null;

      try {
        const previousRefs = sourceDeployment.previousRevisionRefs as Record<
          string,
          { aws?: string; azure?: string }
        >;

        const inserted = await db
          .insert(deployments)
          .values({
            projectId: sourceDeployment.projectId,
            commitSha: sourceDeployment.commitSha,
            branch: sourceDeployment.branch,
            status: "rolling_back",
            rolledBackTo: deploymentId,
            rollbackReason: "manual",
            startedAt: new Date(),
          })
          .returning();

        rollbackDeployment = inserted[0] ?? null;

        if (!rollbackDeployment) {
          throw new Error("Insert returned no rows");
        }

        // ── Trigger the rollback workflow via Temporal ─────────────────────
        // Import the Temporal plugin lazily to avoid circular deps
        const { startRollbackWorkflow } = await import("../plugins/temporal.js");

        const services = Object.entries(previousRefs).map(([serviceName, refs]) => ({
          serviceName,
          cloudProvider: ("aws" in refs && refs.aws ? "aws" : "azure") as "aws" | "azure",
          previousTaskDefinitionArn: refs.aws,
          previousRevisionName: refs.azure,
        }));

        await startRollbackWorkflow({
          deploymentId: rollbackDeployment.id,
          projectId: sourceDeployment.projectId,
          reason: "manual",
          services,
        });
      } catch (err) {
        return reply.status(500).send({
          error: `Failed to start rollback: ${(err as Error).message}`,
        });
      }

      return reply.status(202).send({
        rollbackDeploymentId: rollbackDeployment!.id,
        message: "Rollback initiated. Track progress at the rollback deployment page.",
      });
    }
  );
}
