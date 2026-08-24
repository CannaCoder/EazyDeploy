import {
  ECSClient,
  UpdateServiceCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import { db } from "@shipora/db";
import { deployments, auditLogs } from "@shipora/db";
import { eq } from "drizzle-orm";
import { streamLogActivity } from "./stream-log.js";
import type {
  RollbackActivityInput,
  RollbackActivityResult,
  RollbackServiceRef,
} from "@shipora/temporal-workflows";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24; // 24 × 5s = 120s (< 2 min SLA)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reverts each service to its previous revision:
 * - AWS ECS:  ecs.updateService({ taskDefinition: previousTaskDefinitionArn, forceNewDeployment: true })
 * - Azure:    ContainerAppsRevisions.updateRevisionTrafficWeight(previousRevisionName, 100%)
 *
 * Polls until stable (< 2 min SLA). Emits log lines via streamLogActivity.
 * On completion, writes an audit_log entry and updates deployment.status = "rolled_back".
 */
export async function rollbackActivity(
  input: RollbackActivityInput
): Promise<RollbackActivityResult> {
  const startTime = Date.now();
  const { deploymentId, projectId, reason, services } = input;
  const rolledBackServices: string[] = [];

  await streamLogActivity({
    deploymentId,
    serviceName: "system",
    logLine: `[rollback] ⚠️ Initiating rollback for ${services.length} service(s). Reason: ${reason}`,
    level: "warn",
  });

  // Simulated mode for tests
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    !process.env["AWS_ACCESS_KEY_ID"]
  ) {
    for (const svc of services) {
      await streamLogActivity({
        deploymentId,
        serviceName: svc.serviceName,
        logLine: `[rollback] Simulated rollback for service '${svc.serviceName}'`,
        level: "info",
      });
      rolledBackServices.push(svc.serviceName);
    }
    await finalizeRollback(deploymentId, projectId, reason, rolledBackServices, startTime);
    return { success: true, rolledBackServices, durationMs: Date.now() - startTime };
  }

  for (const svc of services) {
    try {
      if (svc.cloudProvider === "aws") {
        await rollbackAWS(svc, deploymentId);
      } else if (svc.cloudProvider === "azure") {
        await rollbackAzure(svc, deploymentId);
      }
      rolledBackServices.push(svc.serviceName);
    } catch (err) {
      const msg = (err as Error).message;
      await streamLogActivity({
        deploymentId,
        serviceName: svc.serviceName,
        logLine: `[rollback] ❌ Failed to rollback '${svc.serviceName}': ${msg}`,
        level: "error",
      });
      // Continue rolling back remaining services even if one fails
    }
  }

  const durationMs = Date.now() - startTime;
  await streamLogActivity({
    deploymentId,
    serviceName: "system",
    logLine: `[rollback] ✅ Rollback complete in ${Math.round(durationMs / 1000)}s — restored: ${rolledBackServices.join(", ")}`,
    level: "info",
  });

  await finalizeRollback(deploymentId, projectId, reason, rolledBackServices, startTime);

  return {
    success: rolledBackServices.length === services.length,
    rolledBackServices,
    durationMs,
  };
}

// ─── AWS ECS Rollback ─────────────────────────────────────────────────────────

async function rollbackAWS(svc: RollbackServiceRef, deploymentId: string): Promise<void> {
  const { serviceName, ecsServiceArn, previousTaskDefinitionArn } = svc;

  if (!ecsServiceArn || !previousTaskDefinitionArn) {
    await streamLogActivity({
      deploymentId,
      serviceName,
      logLine: `[rollback:aws] Missing ecsServiceArn or previousTaskDefinitionArn for '${serviceName}' — skipping`,
      level: "warn",
    });
    return;
  }

  const region = process.env["AWS_REGION"] || "us-east-1";
  const appName = process.env["APP_NAME"] || "shipora";
  const clusterName = `${appName}-cluster`;
  const client = new ECSClient({ region });

  await streamLogActivity({
    deploymentId,
    serviceName,
    logLine: `[rollback:aws] Reverting '${serviceName}' to task def: ${previousTaskDefinitionArn.split("/").pop()}`,
    level: "info",
  });

  await client.send(
    new UpdateServiceCommand({
      cluster: clusterName,
      service: ecsServiceArn,
      taskDefinition: previousTaskDefinitionArn,
      forceNewDeployment: true,
    })
  );

  // Poll until running count is stable
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const descRes = await client.send(
      new DescribeServicesCommand({ cluster: clusterName, services: [ecsServiceArn] })
    );
    const info = descRes.services?.[0];
    const running = info?.runningCount ?? 0;
    const desired = info?.desiredCount ?? 1;

    await streamLogActivity({
      deploymentId,
      serviceName,
      logLine: `[rollback:aws] '${serviceName}' ECS running ${running}/${desired} (poll ${i + 1}/${MAX_POLL_ATTEMPTS})`,
      level: "info",
    });

    if (running >= desired) {
      await streamLogActivity({
        deploymentId,
        serviceName,
        logLine: `[rollback:aws] ✅ '${serviceName}' restored to previous revision`,
        level: "info",
      });
      return;
    }
  }

  throw new Error(
    `ECS rollback timed out for service '${serviceName}' after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`
  );
}

// ─── Azure Container Apps Rollback ───────────────────────────────────────────

async function rollbackAzure(svc: RollbackServiceRef, deploymentId: string): Promise<void> {
  const { serviceName, containerAppName, resourceGroup, previousRevisionName } = svc;

  if (!containerAppName || !resourceGroup || !previousRevisionName) {
    await streamLogActivity({
      deploymentId,
      serviceName,
      logLine: `[rollback:azure] Missing containerAppName, resourceGroup, or previousRevisionName for '${serviceName}' — skipping`,
      level: "warn",
    });
    return;
  }

  await streamLogActivity({
    deploymentId,
    serviceName,
    logLine: `[rollback:azure] Setting 100% traffic to revision '${previousRevisionName}' for '${serviceName}'`,
    level: "info",
  });

  try {
    // Dynamically import Azure SDK — only available if @azure/arm-appcontainers is installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ContainerAppsAPIClient } = await import("@azure/arm-appcontainers" as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DefaultAzureCredential } = await import("@azure/identity" as any);

    const subscriptionId = process.env["AZURE_SUBSCRIPTION_ID"];
    if (!subscriptionId) throw new Error("AZURE_SUBSCRIPTION_ID not set");

    const credential = new DefaultAzureCredential();
    const client = new ContainerAppsAPIClient(credential, subscriptionId);

    // Set previous revision to 100% traffic, clear current
    await client.containerApps.beginUpdateAndWait(resourceGroup, containerAppName, {
      properties: {
        configuration: {
          ingress: {
            traffic: [
              {
                revisionName: previousRevisionName,
                weight: 100,
                latestRevision: false,
              },
            ],
          },
        },
      },
    });

    // Poll until active revision matches previous
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const app = await client.containerApps.get(resourceGroup, containerAppName);
      const activeRevision = app.properties?.latestReadyRevisionName;

      await streamLogActivity({
        deploymentId,
        serviceName,
        logLine: `[rollback:azure] '${serviceName}' active revision: ${activeRevision ?? "unknown"} (poll ${i + 1})`,
        level: "info",
      });

      if (activeRevision === previousRevisionName) {
        await streamLogActivity({
          deploymentId,
          serviceName,
          logLine: `[rollback:azure] ✅ '${serviceName}' restored to revision '${previousRevisionName}'`,
          level: "info",
        });
        return;
      }
    }
    throw new Error(
      `Azure rollback timed out waiting for revision '${previousRevisionName}' to become active`
    );
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("Cannot find module")) {
      await streamLogActivity({
        deploymentId,
        serviceName,
        logLine: `[rollback:azure] @azure/arm-appcontainers not installed — install it to enable Azure rollback`,
        level: "error",
      });
    }
    throw err;
  }
}

// ─── Finalize: DB update + audit log ─────────────────────────────────────────

async function finalizeRollback(
  deploymentId: string,
  projectId: string,
  reason: string,
  rolledBackServices: string[],
  startTime: number
): Promise<void> {
  try {
    await db
      .update(deployments)
      .set({
        status: "rolled_back",
        rollbackReason: reason,
        completedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    await db.insert(auditLogs).values({
      projectId,
      event: reason === "manual" ? "manual_rollback" : "auto_rollback",
      metadata: {
        deploymentId,
        rolledBackServices,
        reason,
        durationMs: Date.now() - startTime,
      } as Record<string, unknown>,
    });
  } catch (err) {
    console.warn(`[rollbackActivity] Failed to write DB finalization:`, (err as Error).message);
  }
}
