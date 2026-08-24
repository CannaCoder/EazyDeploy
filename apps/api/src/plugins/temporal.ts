import { Client, Connection } from "@temporalio/client";
import type {
  ConflictGuardWorkflowInput,
  DeployWorkflowInput,
  DeployProgress,
  RollbackActivityInput,
} from "@shipora/temporal-workflows";

let temporalClientInstance: Client | null = null;

export async function getTemporalClient(): Promise<Client | null> {
  if (process.env["NODE_ENV"] === "test" || process.env["VITEST"] === "true") {
    return null;
  }

  if (temporalClientInstance) {
    return temporalClientInstance;
  }

  const address = process.env["TEMPORAL_ADDRESS"] || "localhost:7233";
  const namespace = process.env["TEMPORAL_NAMESPACE"] || "default";
  const apiKey = process.env["TEMPORAL_API_KEY"];
  const cert = process.env["TEMPORAL_MTLS_TLS_CERT"] || process.env["TEMPORAL_CLIENT_CERT"];
  const key = process.env["TEMPORAL_MTLS_TLS_KEY"] || process.env["TEMPORAL_CLIENT_KEY"];

  try {
    let connection: Connection;

    if (apiKey) {
      connection = await Connection.connect({
        address,
        apiKey,
        tls: true,
      });
    } else if (cert && key) {
      connection = await Connection.connect({
        address,
        tls: {
          clientCertPair: {
            crt: Buffer.from(cert, "utf-8"),
            key: Buffer.from(key, "utf-8"),
          },
        },
      });
    } else {
      connection = await Connection.connect({
        address,
      });
    }

    temporalClientInstance = new Client({
      connection,
      namespace,
    });

    return temporalClientInstance;
  } catch (err: unknown) {
    console.warn(`[Temporal Client] Could not connect to Temporal at ${address}:`, (err as Error).message);
    return null;
  }
}

/**
 * Starts the ConflictGuardWorkflow asynchronously via Temporal Cloud.
 */
export async function startConflictGuardWorkflow(
  input: ConflictGuardWorkflowInput
): Promise<{ workflowId: string; firstExecutionRunId?: string } | null> {
  const workflowId = `conflict-guard-${input.projectId}-${input.commitSha.slice(0, 7)}-${Date.now()}`;

  const client = await getTemporalClient();
  if (!client) {
    return { workflowId };
  }

  try {
    const handle = await client.workflow.start("conflictGuardWorkflow", {
      taskQueue: process.env["TEMPORAL_TASK_QUEUE"] || "conflict-guard",
      workflowId,
      args: [input],
    });

    return {
      workflowId: handle.workflowId,
      firstExecutionRunId: handle.firstExecutionRunId,
    };
  } catch (err: unknown) {
    console.warn(`[Temporal Client] Failed to start workflow ${workflowId}:`, (err as Error).message);
    return { workflowId };
  }
}

/**
 * Starts the DeployWorkflow asynchronously via Temporal Cloud.
 */
export async function startDeployWorkflow(
  input: DeployWorkflowInput
): Promise<{ workflowId: string; firstExecutionRunId?: string } | null> {
  const workflowId = `deploy-${input.projectId}-${input.commitSha.slice(0, 7)}-${Date.now()}`;

  const client = await getTemporalClient();
  if (!client) {
    return { workflowId };
  }

  try {
    const handle = await client.workflow.start("deployWorkflow", {
      taskQueue: process.env["TEMPORAL_TASK_QUEUE"] || "conflict-guard",
      workflowId,
      args: [input],
    });

    return {
      workflowId: handle.workflowId,
      firstExecutionRunId: handle.firstExecutionRunId,
    };
  } catch (err: unknown) {
    console.warn(`[Temporal Client] Failed to start deploy workflow ${workflowId}:`, (err as Error).message);
    return { workflowId };
  }
}

/**
 * Queries the current DeployWorkflow progress from Temporal Cloud.
 */
export async function getDeployWorkflowProgress(
  workflowId: string
): Promise<DeployProgress | null> {
  const client = await getTemporalClient();
  if (!client) {
    return null;
  }

  try {
    const handle = client.workflow.getHandle(workflowId);
    const progress = await handle.query<DeployProgress>("getDeployProgress");
    return progress;
  } catch {
    return null;
  }
}

/**
 * Starts a manual rollback by executing rollbackActivity via Temporal.
 */
export async function startRollbackWorkflow(
  input: RollbackActivityInput
): Promise<{ workflowId: string } | null> {
  const workflowId = `rollback-${input.deploymentId}-${Date.now()}`;

  const client = await getTemporalClient();
  if (!client) {
    return { workflowId };
  }

  try {
    const handle = await client.workflow.start("rollbackWorkflow", {
      taskQueue: process.env["TEMPORAL_TASK_QUEUE"] || "conflict-guard",
      workflowId,
      args: [input],
    });
    return { workflowId: handle.workflowId };
  } catch (err: unknown) {
    console.warn(
      `[Temporal Client] Failed to start rollback workflow ${workflowId}:`,
      (err as Error).message
    );
    return { workflowId };
  }
}


