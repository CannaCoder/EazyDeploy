import type { FastifyPluginAsync } from "fastify";
import { db, cloudConnections } from "@shipora/db";
import { randomUUID } from "crypto";
import { env } from "../env.js";
import { inMemoryCloudConnections, ensureDefaultUser } from "./cloud-connect.js";
import { encryptIfPresent } from "../lib/crypto.js";

export const gcpOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Start Google Cloud OAuth 2.0 Flow
  fastify.get<{
    Querystring: { projectId?: string; state?: string; returnTo?: string };
  }>("/auth/gcp/start", async (request, reply) => {
    const rawClientId = env.GCP_CLIENT_ID || process.env["GOOGLE_CLIENT_ID"];
    const hasRealGcpClient = Boolean(rawClientId && rawClientId !== "eazydeploy-gcp-client-id");
    const redirectUri = env.GCP_REDIRECT_URI;

    const stateObj = {
      projectId: request.query.projectId || null,
      returnTo: request.query.returnTo || "/dashboard/settings/cloud-connections",
      nonce: randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    if (!hasRealGcpClient) {
      // If GCP_CLIENT_ID is not configured in .env, route to simulated callback
      // to allow full local development testing without getting Google's 401 invalid_client error.
      const devCallbackUrl = `${env.API_URL}/auth/gcp/callback?code=mock_gcp_dev_code&state=${state}`;
      return reply.send({
        success: true,
        configured: false,
        authUrl: devCallbackUrl,
        message: "GCP_CLIENT_ID is not configured in .env. Running in local dev simulation mode.",
      });
    }

    const scopes = encodeURIComponent(
      "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email openid"
    );
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${rawClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`;

    return reply.send({
      success: true,
      configured: true,
      authUrl,
    });
  });

  // 2. Google Cloud OAuth 2.0 Callback
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string; error_description?: string };
  }>("/auth/gcp/callback", async (request, reply) => {
    const { code, state, error, error_description } = request.query;
    const webDashboardUrl = env.WEB_DASHBOARD_URL;

    let projectId: string | null = null;
    let returnTo = "/dashboard/settings/cloud-connections";
    if (state) {
      try {
        const parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        projectId = parsedState.projectId || null;
        if (parsedState.returnTo) returnTo = parsedState.returnTo;
      } catch {
        /* ignore */
      }
    }

    if (error || !code) {
      const errorMsg = error_description || error || "Google Cloud authorization was cancelled or failed";
      return reply.redirect(
        `${webDashboardUrl}${returnTo}?status=error&message=${encodeURIComponent(errorMsg)}`
      );
    }

    const connectionId = randomUUID();
    let accessToken = "mock_gcp_access_token_" + randomUUID().slice(0, 8);
    let displayName = "Google Cloud Account";
    let gcpProjectId = env.GCP_PROJECT_ID || "gcp-proj-" + randomUUID().slice(0, 8);

    const isMockCode = code.startsWith("mock_") || process.env["NODE_ENV"] === "test";
    const gcpClientId = env.GCP_CLIENT_ID || process.env["GOOGLE_CLIENT_ID"];
    const gcpClientSecret = env.GCP_CLIENT_SECRET || process.env["GOOGLE_CLIENT_SECRET"];

    if (!isMockCode && gcpClientId && gcpClientSecret) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: gcpClientId,
            client_secret: gcpClientSecret,
            redirect_uri: env.GCP_REDIRECT_URI,
            grant_type: "authorization_code",
          }).toString(),
        });

        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
          error_description?: string;
        };

        if (tokenData.access_token) {
          accessToken = tokenData.refresh_token || tokenData.access_token;
        }

        // Fetch user profile
        const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token || accessToken}` },
        });

        if (userinfoRes.ok) {
          const userData = (await userinfoRes.json()) as { email?: string; name?: string };
          if (userData.email) {
            displayName = `Google Cloud (${userData.email})`;
          }
        }

        // Query available projects via Resource Manager API
        const projectsRes = await fetch("https://cloudresourcemanager.googleapis.com/v1/projects", {
          headers: { Authorization: `Bearer ${tokenData.access_token || accessToken}` },
        });

        if (projectsRes.ok) {
          const projectsData = (await projectsRes.json()) as {
            projects?: Array<{ projectId?: string; name?: string }>;
          };
          if (projectsData.projects && projectsData.projects.length > 0) {
            const firstProj = projectsData.projects[0];
            if (firstProj?.projectId) {
              gcpProjectId = firstProj.projectId;
              displayName = `${firstProj.name || firstProj.projectId} (GCP)`;
            }
          }
        }
      } catch (err) {
        fastify.log.warn(`[GCP OAuth] Token exchange notice: ${(err as Error).message}`);
      }
    }

    const encryptedToken = encryptIfPresent(accessToken);

    const connObj = {
      id: connectionId,
      userId: "550e8400-e29b-41d4-a716-446655440000",
      projectId,
      provider: "gcp",
      displayName,
      clientId: gcpProjectId,
      clientSecretRef: encryptedToken,
      resourceGroup: "us-central1", // default region
      status: "connected" as const,
      connectedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    inMemoryCloudConnections.set(connectionId, connObj);

    try {
      await ensureDefaultUser("550e8400-e29b-41d4-a716-446655440000");
      if (process.env["DATABASE_URL"]) {
        await db.insert(cloudConnections).values({
          id: connectionId,
          userId: "550e8400-e29b-41d4-a716-446655440000",
          projectId,
          provider: "gcp",
          displayName,
          clientId: gcpProjectId,
          clientSecretRef: encryptedToken,
          resourceGroup: "us-central1",
          status: "connected",
          connectedAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
    } catch (dbErr) {
      fastify.log.warn(`[GCP OAuth] DB insert warning: ${(dbErr as Error).message}`);
    }

    return reply.redirect(
      `${webDashboardUrl}${returnTo}?status=connected&provider=gcp&connectionId=${connectionId}`
    );
  });

  // 3. Direct Google Cloud Service Account Key JSON or Access Token Connect
  fastify.post<{
    Body: {
      key: string | Record<string, unknown>;
      projectId?: string;
      displayName?: string;
      region?: string;
      userId?: string;
    };
  }>("/auth/gcp/connect-key", async (request, reply) => {
    const { key, projectId, displayName, region, userId } = request.body || {};

    if (!key) {
      return reply.status(400).send({
        success: false,
        error: "Google Cloud Service Account key JSON or access token is required.",
      });
    }

    let rawKeyString = "";
    let detectedProjectId = projectId?.trim() || "";
    let detectedClientEmail = "";

    if (typeof key === "string") {
      rawKeyString = key.trim();
      try {
        const parsed = JSON.parse(rawKeyString);
        if (parsed.project_id) detectedProjectId = parsed.project_id;
        if (parsed.client_email) detectedClientEmail = parsed.client_email;
      } catch {
        // Raw token or base64
      }
    } else if (typeof key === "object" && key !== null) {
      rawKeyString = JSON.stringify(key);
      const parsed = key as Record<string, string>;
      if (parsed["project_id"]) detectedProjectId = parsed["project_id"];
      if (parsed["client_email"]) detectedClientEmail = parsed["client_email"];
    }

    if (!detectedProjectId) {
      detectedProjectId = "gcp-proj-" + randomUUID().slice(0, 8);
    }

    let accountName = displayName?.trim();
    if (!accountName) {
      if (detectedClientEmail) {
        accountName = `GCP (${detectedClientEmail})`;
      } else {
        accountName = `Google Cloud (${detectedProjectId})`;
      }
    }

    const connectionId = randomUUID();
    const effectiveUserId = userId || "550e8400-e29b-41d4-a716-446655440000";
    const encryptedKey = encryptIfPresent(rawKeyString);

    const connObj = {
      id: connectionId,
      userId: effectiveUserId,
      projectId: null,
      provider: "gcp",
      displayName: accountName,
      clientId: detectedProjectId,
      clientSecretRef: encryptedKey,
      resourceGroup: region?.trim() || "us-central1",
      status: "connected" as const,
      connectedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    inMemoryCloudConnections.set(connectionId, connObj);

    try {
      await ensureDefaultUser(effectiveUserId);
      if (process.env["DATABASE_URL"]) {
        await db.insert(cloudConnections).values({
          id: connectionId,
          userId: effectiveUserId,
          projectId: null,
          provider: "gcp",
          displayName: accountName,
          clientId: detectedProjectId,
          clientSecretRef: encryptedKey,
          resourceGroup: region?.trim() || "us-central1",
          status: "connected",
          connectedAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
    } catch {
      // In dev mode without DB
    }

    return reply.send({
      success: true,
      connection: {
        id: connectionId,
        provider: "gcp",
        displayName: accountName,
        projectId: detectedProjectId,
        region: region?.trim() || "us-central1",
        status: "connected",
        connectedAt: connObj.connectedAt,
      },
    });
  });
};
