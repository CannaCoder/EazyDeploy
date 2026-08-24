import { proxyActivities } from "@temporalio/workflow";
import type {
  DeployActivities,
  RollbackActivityInput,
  RollbackActivityResult,
} from "../activities/deploy-activities.js";

const { rollbackActivity } = proxyActivities<DeployActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "2s",
    maximumInterval: "15s",
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
});

/**
 * Standalone workflow used when a manual rollback is triggered from
 * the dashboard UI or the POST /deployments/:id/rollback endpoint.
 */
export async function rollbackWorkflow(
  input: RollbackActivityInput
): Promise<RollbackActivityResult> {
  return await rollbackActivity(input);
}
