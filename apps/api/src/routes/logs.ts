import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Redis } from "@upstash/redis";
import { db } from "@shipora/db";
import { deploymentLogs, deployments } from "@shipora/db";
import { eq, asc } from "drizzle-orm";
import { getAuth } from "@clerk/fastify";

const ACTIVE_STATUSES = new Set([
  "building",
  "deploying",
  "verifying",
  "rolling_back",
]);

const KEEPALIVE_INTERVAL_MS = 15_000;

export const inMemoryLogStore = new Map<string, any[]>();
const sseSubscribers = new Map<string, Set<(data: string) => void>>();

export function broadcastLogLine(deploymentId: string, logItem: any) {
  const existing = inMemoryLogStore.get(deploymentId) || [];
  existing.push(logItem);
  inMemoryLogStore.set(deploymentId, existing);

  const subs = sseSubscribers.get(deploymentId);
  if (subs) {
    const payload = JSON.stringify(logItem);
    for (const send of subs) {
      send(payload);
    }
  }
}

function getRedis(): Redis | null {
  if (!process.env["UPSTASH_REDIS_REST_URL"]) return null;
  return Redis.fromEnv();
}

/**
 * GET /deployments/:id/logs
 *
 * Server-Sent Events endpoint that streams deployment log lines to the browser.
 */
export async function logRoutes(app: FastifyInstance) {
  // Direct HTTP log push endpoint used by worker activities
  app.post<{
    Params: { id: string };
    Body: { serviceName: string; logLine: string; level: string; timestamp?: string };
  }>("/deployments/:id/logs/push", async (request, reply) => {
    const { id: deploymentId } = request.params;
    const body = request.body || ({} as any);
    const logItem = {
      serviceName: body.serviceName || "system",
      logLine: body.logLine || "",
      level: body.level || "info",
      timestamp: body.timestamp || new Date().toISOString(),
    };
    broadcastLogLine(deploymentId, logItem);
    return reply.send({ success: true });
  });

  app.get(
    "/deployments/:id/logs",
    {
      config: { rawBody: false },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { token?: string } }>,
      reply: FastifyReply
    ) => {
      const { id: deploymentId } = request.params;

      // ── Auth: Safe optional check for SSE streaming ───────────────────────
      let userId: string | null = null;
      try {
        const auth = getAuth(request);
        userId = auth.userId;
      } catch {
        // Clerk plugin not registered or auth not present — allow in dev
      }
      if (!userId && process.env["NODE_ENV"] === "production") {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // ── Validate deployment exists ─────────────────────────────────────────
      let deployment: { status: string } | null = null;
      try {
        const rows = await db
          .select({ status: deployments.status })
          .from(deployments)
          .where(eq(deployments.id, deploymentId))
          .limit(1);
        deployment = rows[0] ?? null;
      } catch {
        // Dev fallback — allow streaming without DB
      }

      const isActive = !deployment || ACTIVE_STATUSES.has(deployment.status);

      // ── Set SSE headers ────────────────────────────────────────────────────
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
      });

      const send = (data: string, event?: string) => {
        if (reply.raw.destroyed) return;
        if (event) reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${data}\n\n`);
      };

      // Register subscriber for live broadcast
      if (!sseSubscribers.has(deploymentId)) {
        sseSubscribers.set(deploymentId, new Set());
      }
      const subs = sseSubscribers.get(deploymentId)!;
      subs.add(send);

      // Keepalive to prevent proxy timeout
      const keepaliveTimer = setInterval(() => {
        if (!reply.raw.destroyed) {
          reply.raw.write(": keepalive\n\n");
        }
      }, KEEPALIVE_INTERVAL_MS);

      // ── Cleanup on client disconnect ───────────────────────────────────────
      request.raw.on("close", () => {
        clearInterval(keepaliveTimer);
        subs.delete(send);
        if (subs.size === 0) sseSubscribers.delete(deploymentId);
        if (!reply.raw.destroyed) reply.raw.end();
      });

      // Send all existing in-memory and persisted logs immediately
      await streamPersistedLogs(deploymentId, send);

      if (!isActive) {
        send(JSON.stringify({ done: true }), "done");
        clearInterval(keepaliveTimer);
        subs.delete(send);
        reply.raw.end();
      }

      // Tell Fastify not to finalize the response — we control it
      return reply;
    }
  );
}

async function streamPersistedLogs(
  deploymentId: string,
  send: (data: string) => void
): Promise<void> {
  const sent = new Set<string>();

  // 1. Send in-memory logs first
  const memoryLogs = inMemoryLogStore.get(deploymentId) || [];
  for (const item of memoryLogs) {
    const key = `${item.serviceName}:${item.timestamp}:${item.logLine}`;
    if (!sent.has(key)) {
      sent.add(key);
      send(JSON.stringify(item));
    }
  }

  // 2. Query DB rows
  try {
    const rows = await db
      .select()
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, deploymentId))
      .orderBy(asc(deploymentLogs.timestamp));

    for (const row of rows) {
      const item = {
        serviceName: row.serviceName,
        logLine: row.logLine,
        level: row.level,
        timestamp: row.timestamp?.toISOString(),
      };
      const key = `${item.serviceName}:${item.timestamp}:${item.logLine}`;
      if (!sent.has(key)) {
        sent.add(key);
        send(JSON.stringify(item));
      }
    }
  } catch {
    // Non-fatal — DB might not be available in dev
  }
}
