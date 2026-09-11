import type { FastifyPluginAsync } from "fastify";
import { db, cloudConnections } from "@shipora/db";
import { randomUUID } from "crypto";
import { env } from "../env.js";
import { inMemoryCloudConnections, ensureDefaultUser } from "./cloud-connect.js";
import { encryptIfPresent } from "../lib/crypto.js";

export const digitalOceanOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Start DigitalOcean OAuth 2.0 Flow
  fastify.get<{
    Querystring: { projectId?: string; state?: string; returnTo?: string };
  }>("/auth/digitalocean/start", async (request, reply) => {
    const rawClientId = env.DO_CLIENT_ID || process.env["DIGITALOCEAN_CLIENT_ID"];
    const hasRealDoClient = Boolean(rawClientId && rawClientId !== "shipora-do-client-id");
    const redirectUri = env.DO_REDIRECT_URI;

    const stateObj = {
      projectId: request.query.projectId || null,
      returnTo: request.query.returnTo || "/dashboard/settings/cloud-connections",
      nonce: randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    if (!hasRealDoClient) {
      const devCallbackUrl = `${env.API_URL}/auth/digitalocean/callback?code=mock_do_dev_code&state=${state}`;
      return reply.send({
        success: true,
        configured: false,
        authUrl: devCallbackUrl,
        message: "DO_CLIENT_ID is not configured in .env. Running in local dev simulation mode.",
      });
    }

    const scopes = encodeURIComponent("read write");
    const authUrl = `https://cloud.digitalocean.com/v1/oauth/authorize?client_id=${rawClientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scopes}&state=${state}`;

    return reply.send({
      success: true,
      configured: true,
      authUrl,
    });
  });

  // 2. DigitalOcean OAuth 2.0 Callback
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string; error_description?: string };
  }>("/auth/digitalocean/callback", async (request, reply) => {
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
      const errorMsg = error_description || error || "DigitalOcean authorization was cancelled or failed";
      return reply.redirect(
        `${webDashboardUrl}${returnTo}?status=error&message=${encodeURIComponent(errorMsg)}`
      );
    }

    const connectionId = randomUUID();
    let accessToken = "mock_do_access_token_" + randomUUID().slice(0, 8);
    let displayName = "DigitalOcean Account";
    let accountUuid = "do-" + randomUUID().slice(0, 8);

    const isMockCode = code.startsWith("mock_") || process.env["NODE_ENV"] === "test";

    if (!isMockCode && env.DO_CLIENT_ID && env.DO_CLIENT_SECRET) {
      try {
        const tokenRes = await fetch("https://cloud.digitalocean.com/v1/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: env.DO_CLIENT_ID,
            client_secret: env.DO_CLIENT_SECRET,
            code,
            redirect_uri: env.DO_REDIRECT_URI,
          }).toString(),
        });

        const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
        }

        // Fetch user account details
        const accountRes = await fetch("https://api.digitalocean.com/v2/account", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (accountRes.ok) {
          const accountData = (await accountRes.json()) as {
            account?: { email?: string; uuid?: string; status?: string };
          };
          if (accountData.account?.email) {
            displayName = `DigitalOcean (${accountData.account.email})`;
          }
          if (accountData.account?.uuid) {
            accountUuid = accountData.account.uuid;
          }
        }
      } catch (err) {
        fastify.log.warn(`[DO OAuth] Token exchange notice: ${(err as Error).message}`);
      }
    }

    const encryptedToken = encryptIfPresent(accessToken);

    const connObj = {
      id: connectionId,
      userId: "550e8400-e29b-41d4-a716-446655440000",
      projectId,
      provider: "digitalocean",
      displayName,
      clientId: accountUuid,
      clientSecretRef: encryptedToken,
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
          provider: "digitalocean",
          displayName,
          clientId: accountUuid,
          clientSecretRef: encryptedToken,
          status: "connected",
          connectedAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
    } catch (dbErr) {
      fastify.log.warn(`[DO OAuth] DB insert warning: ${(dbErr as Error).message}`);
    }

    return reply.redirect(
      `${webDashboardUrl}${returnTo}?status=connected&provider=digitalocean&connectionId=${connectionId}`
    );
  });

  // 3. Direct DigitalOcean Personal Access Token Connect
  fastify.post<{
    Body: {
      token: string;
      displayName?: string;
      userId?: string;
      projectId?: string;
    };
  }>("/auth/digitalocean/connect-token", async (request, reply) => {
    const { token, displayName, userId, projectId } = request.body || {};

    if (!token || typeof token !== "string" || !token.trim()) {
      return reply.status(400).send({
        success: false,
        error: "DigitalOcean Personal Access Token is required.",
      });
    }

    const trimmedToken = token.trim();
    let accountName = displayName?.trim() || "DigitalOcean Account";
    let accountUuid = "do-" + randomUUID().slice(0, 8);

    const isMock = trimmedToken.startsWith("mock_") || process.env["NODE_ENV"] === "test";

    if (!isMock) {
      try {
        const accountRes = await fetch("https://api.digitalocean.com/v2/account", {
          headers: { Authorization: `Bearer ${trimmedToken}` },
        });

        if (!accountRes.ok) {
          throw new Error("Invalid DigitalOcean API token. Please verify your token permissions.");
        }

        const accountData = (await accountRes.json()) as {
          account?: { email?: string; uuid?: string; status?: string };
        };

        if (accountData.account?.email && !displayName) {
          accountName = `DigitalOcean (${accountData.account.email})`;
        }
        if (accountData.account?.uuid) {
          accountUuid = accountData.account.uuid;
        }
      } catch (err: unknown) {
        return reply.status(400).send({
          success: false,
          error: (err as Error).message,
        });
      }
    }

    const connectionId = randomUUID();
    const effectiveUserId = userId || "550e8400-e29b-41d4-a716-446655440000";
    const encryptedToken = encryptIfPresent(trimmedToken);

    const connObj = {
      id: connectionId,
      userId: effectiveUserId,
      projectId: projectId || null,
      provider: "digitalocean",
      displayName: accountName,
      clientId: accountUuid,
      clientSecretRef: encryptedToken,
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
          projectId: projectId || null,
          provider: "digitalocean",
          displayName: accountName,
          clientId: accountUuid,
          clientSecretRef: encryptedToken,
          status: "connected",
          connectedAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
    } catch (err: unknown) {
      // In dev mode without DB
    }

    return reply.send({
      success: true,
      connection: {
        id: connectionId,
        provider: "digitalocean",
        displayName: accountName,
        status: "connected",
        connectedAt: connObj.connectedAt,
      },
    });
  });
};
