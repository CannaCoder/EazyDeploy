import type { FastifyPluginAsync } from "fastify";
import { db, cloudConnections } from "@shipora/db";
import { randomUUID } from "crypto";
import { env } from "../env.js";
import { inMemoryCloudConnections, ensureDefaultUser } from "./cloud-connect.js";
import { encryptIfPresent } from "../lib/crypto.js";
import { createCloudAdapter } from "@shipora/cloud-adapters";

export const azureOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Start Azure OAuth 2.0 Flow
  fastify.get<{
    Querystring: { projectId?: string; state?: string; returnTo?: string };
  }>("/auth/azure/start", async (request, reply) => {
    const clientId = env.AZURE_CLIENT_ID;
    const tenantId = env.AZURE_TENANT_ID;
    const redirectUri = env.AZURE_REDIRECT_URI;

    const stateObj = {
      projectId: request.query.projectId || null,
      returnTo: request.query.returnTo || "/dashboard/settings/cloud-connections",
      nonce: randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    const scopes = encodeURIComponent(
      "https://management.azure.com/.default offline_access"
    );

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_mode=query&scope=${scopes}&state=${state}`;

    return reply.send({
      success: true,
      authUrl,
    });
  });

  // 2. Azure OAuth 2.0 Callback — auto-creates a Service Principal on the user's subscription
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string; error_description?: string };
  }>("/auth/azure/callback", async (request, reply) => {
    const { code, state, error, error_description } = request.query;
    const webDashboardUrl = env.WEB_DASHBOARD_URL;

    let projectId: string | null = null;
    let returnTo = "/dashboard/settings/cloud-connections";
    if (state) {
      try {
        const parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        projectId = parsedState.projectId || null;
        if (parsedState.returnTo) returnTo = parsedState.returnTo;
      } catch { /* ignore */ }
    }

    if (error || !code) {
      const errorMsg = error_description || error || "Azure authorization was cancelled or failed";
      return reply.redirect(`${webDashboardUrl}${returnTo}?status=error&message=${encodeURIComponent(errorMsg)}`);
    }

    const connectionId = randomUUID();
    let tenantId = env.AZURE_TENANT_ID;
    let clientId = env.AZURE_CLIENT_ID;
    let clientSecret = env.AZURE_CLIENT_SECRET;
    let subscriptionId = env.AZURE_SUBSCRIPTION_ID || "";
    let displayName = "Azure Subscription";
    const resourceGroup = "eazydeploy-rg";

    try {
      // Step 1: Exchange auth code for user access token
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.AZURE_CLIENT_ID,
            client_secret: env.AZURE_CLIENT_SECRET,
            code,
            redirect_uri: env.AZURE_REDIRECT_URI,
            grant_type: "authorization_code",
            scope: "https://management.azure.com/.default offline_access",
          }).toString(),
        }
      );
      const tokenData = await tokenRes.json() as { access_token?: string; error_description?: string };
      if (!tokenData.access_token) throw new Error(tokenData.error_description || "Token exchange failed");
      const userToken = tokenData.access_token;

      // Step 2: Get the user's first subscription
      const subsRes = await fetch("https://management.azure.com/subscriptions?api-version=2020-01-01", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const subsData = await subsRes.json() as { value?: { subscriptionId: string; displayName: string; tenantId: string }[] };
      const sub = subsData.value?.[0];
      if (sub) {
        subscriptionId = sub.subscriptionId;
        tenantId = sub.tenantId;
        displayName = `Azure: ${sub.displayName}`;
      }

      // Step 3: Auto-create a Service Principal via Microsoft Graph
      const spName = `shipora-deploy-${connectionId}`;
      const appRes = await fetch("https://graph.microsoft.com/v1.0/applications", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: spName }),
      });

      if (appRes.ok) {
        const appData = await appRes.json() as { appId: string; id: string };
        clientId = appData.appId;

        // Create SP object
        await fetch("https://graph.microsoft.com/v1.0/servicePrincipals", {
          method: "POST",
          headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ appId: clientId }),
        });

        // Add client secret to the app
        const pwRes = await fetch(`https://graph.microsoft.com/v1.0/applications/${appData.id}/addPassword`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ passwordCredential: { displayName: "shipora-auto", endDateTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() } }),
        });
        const pwData = await pwRes.json() as { secretText?: string };
        if (pwData.secretText) clientSecret = pwData.secretText;

        // Step 4: Assign Contributor role on the subscription
        const roleId = "b24988ac-6180-42a0-ab88-20f7382dd24c"; // Azure Contributor
        await fetch(
          `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments/${randomUUID()}?api-version=2022-04-01`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              properties: {
                roleDefinitionId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleId}`,
                principalId: appData.id,
                principalType: "ServicePrincipal",
              },
            }),
          }
        );
        fastify.log.info(`[Azure OAuth] Auto-created SP ${clientId} with Contributor role on subscription ${subscriptionId}`);
      } else {
        fastify.log.warn("[Azure OAuth] Graph API unavailable — using platform SP as fallback");
      }
    } catch (err) {
      fastify.log.warn("[Azure OAuth] SP auto-creation failed, using platform credentials:", (err as Error).message);
    }

    // Step 5: Store encrypted credentials
    const encryptedSecret = encryptIfPresent(clientSecret);
    const connObj = {
      id: connectionId,
      userId: "550e8400-e29b-41d4-a716-446655440000",
      projectId,
      provider: "azure",
      displayName,
      tenantId,
      clientId,
      subscriptionId,
      resourceGroup,
      status: "connected",
      connectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
          provider: "azure",
          displayName,
          tenantId,
          clientId,
          clientSecretRef: encryptedSecret,
          subscriptionId,
          resourceGroup,
          status: "connected",
          connectedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          lastUsedAt: new Date(),
        });
      }
    } catch (dbErr) {
      fastify.log.warn("[Azure OAuth] DB insert warning:", (dbErr as Error).message);
    }

    return reply.redirect(`${webDashboardUrl}${returnTo}?status=connected&provider=azure&connectionId=${connectionId}`);
  });

  // 3. Verify Azure Connection
  fastify.post<{
    Body: {
      tenantId: string;
      clientId?: string;
      subscriptionId: string;
      resourceGroup?: string;
      displayName?: string;
      userId?: string;
      projectId?: string;
    };
  }>("/auth/azure/verify", async (request, reply) => {
    const { tenantId, clientId, subscriptionId, resourceGroup, displayName, userId, projectId } = request.body;

    const effectiveClientId = clientId || env.AZURE_CLIENT_ID || "88602e5b-9361-4ff7-9ca4-6105aa7cdec9";
    const effectiveTenantId = tenantId || env.AZURE_TENANT_ID || "23543db5-54c7-4b3a-b22c-5f84b5594471";
    const effectiveUserId = userId || "550e8400-e29b-41d4-a716-446655440000";

    const adapter = createCloudAdapter("azure", {
      tenantId: effectiveTenantId,
      clientId: effectiveClientId,
      subscriptionId,
      resourceGroup: resourceGroup || "shipora-deployments-rg",
    });

    const authRes = await adapter.authenticate();

    if (!authRes.success) {
      return reply.status(400).send({
        success: false,
        error: authRes.error,
      });
    }

    const connectionId = "conn-azure-" + randomUUID().slice(0, 8);
    const connObj = {
      id: connectionId,
      userId: effectiveUserId,
      projectId: projectId || null,
      provider: "azure",
      displayName: displayName || "Azure Subscription (Custom)",
      tenantId: effectiveTenantId,
      clientId: effectiveClientId,
      subscriptionId,
      resourceGroup: resourceGroup || "shipora-deployments-rg",
      status: "connected",
      connectedAt: new Date().toISOString(),
      identityArn: authRes.identityArn,
    };

    inMemoryCloudConnections.set(connectionId, connObj);

    try {
      await ensureDefaultUser(effectiveUserId);
      if (process.env["DATABASE_URL"]) {
        await db.insert(cloudConnections).values({
          id: connectionId,
          userId: effectiveUserId,
          projectId: projectId || null,
          provider: "azure",
          displayName: displayName || "Azure Subscription (Custom)",
          tenantId: effectiveTenantId,
          clientId: effectiveClientId,
          subscriptionId,
          resourceGroup: resourceGroup || "shipora-deployments-rg",
          status: "connected",
          connectedAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
    } catch {
      // In dev / test mode
    }

    return reply.send({
      success: true,
      message: "Azure connection verified successfully",
      connection: connObj,
      identityArn: authRes.identityArn,
    });
  });
};
