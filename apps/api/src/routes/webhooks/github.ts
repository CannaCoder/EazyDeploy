import type { FastifyPluginAsync } from "fastify";
import { validateWebhookSignature, parsePushPayload } from "@shipora/github-app";
import { db, auditLogs, conflictChecks, projects } from "@shipora/db";
import { eq, and } from "drizzle-orm";
import { startConflictGuardWorkflow } from "../../plugins/temporal.js";

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/webhooks/github", async (req, reply) => {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const webhookSecret = process.env["GITHUB_APP_WEBHOOK_SECRET"] || "development-secret";

    // Obtain raw body string
    const rawPayload =
      (req as unknown as { rawBody?: string }).rawBody ||
      (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    if (!signature) {
      return reply.code(401).send({ error: "Missing x-hub-signature-256 header" });
    }

    const isValid = validateWebhookSignature(rawPayload, signature, webhookSecret);
    if (!isValid) {
      return reply.code(401).send({ error: "Invalid webhook signature" });
    }

    const eventName = (req.headers["x-github-event"] as string) || "unknown";
    const parsedPayload = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;

    // 1. Audit log
    try {
      await db.insert(auditLogs).values({
        event: `github.webhook.${eventName}`,
        metadata: parsedPayload,
      });
    } catch {
      // ignore DB errors during detached webhook receipt
    }

    // 2. Handle push events and PR synchronize events for Conflict Guard
    let commitSha: string | undefined;
    let branch: string | undefined;
    let repoOwner: string | undefined;
    let repoName: string | undefined;
    let installationId: number | undefined;

    try {
      if (eventName === "push") {
        const pushData = parsePushPayload(parsedPayload);
        if (pushData) {
          commitSha = pushData.after;
          branch = pushData.ref ? pushData.ref.replace("refs/heads/", "") : undefined;
          repoOwner =
            pushData.repository.owner?.login ||
            (pushData.repository.full_name ? pushData.repository.full_name.split("/")[0] : undefined);
          repoName = pushData.repository.name;
          installationId = pushData.installation?.id;
        }
      } else if (eventName === "pull_request") {
        const pr = parsedPayload as {
          action?: string;
          pull_request?: {
            head?: { sha?: string; ref?: string };
            base?: { ref?: string };
          };
          repository?: { name?: string; owner?: { login?: string } };
          installation?: { id?: number };
        };

        if (["opened", "synchronize", "reopened"].includes(pr.action || "")) {
          commitSha = pr.pull_request?.head?.sha;
          branch = pr.pull_request?.head?.ref;
          repoOwner = pr.repository?.owner?.login;
          repoName = pr.repository?.name;
          installationId = pr.installation?.id;
        }
      }
    } catch (parseErr) {
      fastify.log.warn(`[Webhook] Could not extract git ref: ${(parseErr as Error).message}`);
    }

    // 3. Dispatch ConflictGuardWorkflow if parameters are present
    if (commitSha && branch && repoOwner && repoName) {
      fastify.log.info(
        `[Webhook] Triggering Conflict Guard for ${repoOwner}/${repoName}@${commitSha.slice(0, 7)} on branch ${branch}`
      );

      // Find matching project
      let projectId: string | undefined;
      try {
        const foundProjects = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.githubRepoOwner, repoOwner),
              eq(projects.githubRepoName, repoName)
            )
          )
          .limit(1);

        if (foundProjects[0]) {
          projectId = foundProjects[0].id;
        }
      } catch {
        // ignore DB lookup error
      }

      if (projectId) {
        // Record running check in database
        try {
          await db.insert(conflictChecks).values({
            projectId,
            commitSha,
            branch,
            status: "running",
            mergeConflicts: false,
            lockfileHealthy: true,
            envVarsValid: true,
          });
        } catch {
          // ignore
        }

        // Start Temporal workflow asynchronously
        startConflictGuardWorkflow({
          projectId,
          repoOwner,
          repoName,
          commitSha,
          branch,
          installationId: installationId || 123456,
        }).catch((err) => {
          fastify.log.warn(`[Webhook] Async Temporal workflow start failed: ${(err as Error).message}`);
        });
      }
    }

    return reply.code(202).send({
      received: true,
      event: eventName,
      triggered: Boolean(commitSha),
    });
  });
};
