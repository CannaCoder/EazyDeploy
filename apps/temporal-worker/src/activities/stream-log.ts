import { Redis } from "@upstash/redis";
import { db } from "@shipora/db";
import { deploymentLogs } from "@shipora/db";
import type {
  StreamLogActivityInput,
  StreamLogActivityResult,
} from "@shipora/temporal-workflows";

// Upstash Redis client — uses HTTP, no persistent TCP (safe in Temporal activities)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    !process.env["UPSTASH_REDIS_REST_URL"]
  ) {
    return null;
  }
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

const MAX_LOG_ROWS = 5000;
const logCountCache: Record<string, number> = {};

/**
 * Publishes a single structured log line to:
 * 1. Upstash Redis pub/sub channel  deployments:{deploymentId}:logs
 * 2. deployment_logs DB table (persistent, capped at MAX_LOG_ROWS per deployment)
 *
 * Called from build, provision, verify, and rollback activities to give the
 * browser real-time visibility via the SSE endpoint.
 */
export async function streamLogActivity(
  input: StreamLogActivityInput
): Promise<StreamLogActivityResult> {
  const { deploymentId, serviceName, logLine, level } = input;
  const channel = `deployments:${deploymentId}:logs`;
  const payload = JSON.stringify({
    serviceName,
    logLine,
    level,
    timestamp: new Date().toISOString(),
  });

  let published = false;

  // 1. Direct HTTP Push to API Server for immediate SSE broadcast to connected UI clients
  try {
    const apiBase = process.env["API_URL"] || "http://localhost:4000";
    fetch(`${apiBase}/deployments/${deploymentId}/logs/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {});
  } catch {
    // Non-fatal
  }

  // 2. Publish to Redis pub/sub and log-queue (best-effort — non-fatal)
  try {
    const client = getRedis();
    if (client) {
      await Promise.allSettled([
        client.publish(channel, payload),
        client.rpush(`deployments:${deploymentId}:log-queue`, payload),
      ]);
      published = true;
    }
  } catch (err) {
    console.warn(
      `[streamLogActivity] Redis publish failed for channel ${channel}:`,
      (err as Error).message
    );
  }

  // 3. Persist to DB (capped at MAX_LOG_ROWS per deployment)
  try {
    const count = logCountCache[deploymentId] ?? 0;
    if (count < MAX_LOG_ROWS) {
      await db.insert(deploymentLogs).values({
        deploymentId,
        serviceName,
        logLine,
        level,
        timestamp: new Date(),
      });
      logCountCache[deploymentId] = count + 1;
    }
  } catch (err) {
    // Non-fatal — log persistence is best-effort
    console.warn(
      `[streamLogActivity] DB insert failed for deployment ${deploymentId}:`,
      (err as Error).message
    );
  }

  return { published };
}
