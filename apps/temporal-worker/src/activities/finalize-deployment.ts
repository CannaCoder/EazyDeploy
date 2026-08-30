import { db, deployments, auditLogs } from "@shipora/db";
import { eq } from "drizzle-orm";
import type {
  FinalizeDeploymentActivityInput,
  FinalizeDeploymentActivityResult,
} from "@shipora/temporal-workflows";

/**
 * Activity: finalizeDeploymentActivity
 * Marks the deployment record in the database as completed ('success' or 'failed'),
 * records the completedAt timestamp, deployedUrls, and emits an audit log.
 */
export async function finalizeDeploymentActivity(
  input: FinalizeDeploymentActivityInput
): Promise<FinalizeDeploymentActivityResult> {
  const { deploymentId, projectId, status, deployedUrls, previousRevisionRefs, summary } = input;

  try {
    await db
      .update(deployments)
      .set({
        status,
        completedAt: new Date(),
        deployedUrls: deployedUrls || null,
        previousRevisionRefs: previousRevisionRefs || null,
      })
      .where(eq(deployments.id, deploymentId));

    try {
      await db.insert(auditLogs).values({
        projectId,
        event: status === "success" ? "deployment_success" : "deployment_failed",
        metadata: {
          deploymentId,
          status,
          summary,
          deployedUrls,
        } as Record<string, unknown>,
      });
    } catch {
      // Non-fatal audit log
    }

    return { success: true };
  } catch (err: unknown) {
    console.warn(`[finalizeDeploymentActivity] DB update failed:`, (err as Error).message);
    return { success: false, error: (err as Error).message };
  }
}
