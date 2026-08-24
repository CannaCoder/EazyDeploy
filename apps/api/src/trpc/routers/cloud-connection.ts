import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, cloudConnections, projects } from "@shipora/db";
import { eq, and } from "drizzle-orm";
import {
  CloudProviderEnum,
  CloudConnectionSchema,
  CreateCloudConnectionSchema,
} from "@shipora/types";
import { createCloudAdapter } from "@shipora/cloud-adapters";
import { randomUUID } from "crypto";

export const cloudConnectionRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id || "550e8400-e29b-41d4-a716-446655440000";

    try {
      if (process.env["DATABASE_URL"]) {
        const records = await db.query.cloudConnections.findMany({
          where: eq(cloudConnections.userId, userId),
        });
        if (records.length > 0) return records;
      }
    } catch {
      // Fallback in test/dev mode
    }

    const defaultList: any[] = [];
    if (process.env["AZURE_CLIENT_SECRET"] || process.env["AZURE_SUBSCRIPTION_ID"]) {
      defaultList.push({
        id: "demo-azure-connection",
        userId,
        projectId: null,
        provider: "azure" as const,
        displayName: "Azure Subscription (Central India)",
        subscriptionId: process.env["AZURE_SUBSCRIPTION_ID"] || "e5e3efbf-67c3-43d5-8f04-75ddb07bf8c7",
        resourceGroup: process.env["AZURE_RESOURCE_GROUP"] || "eazydeploy-rg",
        tenantId: process.env["AZURE_TENANT_ID"] || "23543db5-54c7-4b3a-b22c-5f84b5594471",
        status: "connected" as const,
        connectedAt: new Date(),
        expiresAt: null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      });
    }
    defaultList.push({
      id: "demo-aws-connection",
      userId,
      projectId: null,
      provider: "aws" as const,
      displayName: "Default AWS (Demo)",
      roleArn: "arn:aws:iam::123456789012:role/shipora-deploy-role",
      externalId: "shipora-demo-ext",
      status: "connected" as const,
      connectedAt: new Date(),
      expiresAt: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
    });

    return defaultList;
  }),

  getForProject: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      if (!process.env["DATABASE_URL"]) {
        return {
          provider: "aws" as const,
          connection: null,
        };
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        return null;
      }

      const provider = (project.cloudProvider as "aws" | "azure") || "aws";

      if (project.cloudConnectionId) {
        const conn = await db.query.cloudConnections.findFirst({
          where: eq(cloudConnections.id, project.cloudConnectionId),
        });
        return {
          provider,
          connection: conn || null,
        };
      }

      // Check account-level default
      const defaultConn = await db.query.cloudConnections.findFirst({
        where: and(
          eq(cloudConnections.provider, provider),
          eq(cloudConnections.userId, project.ownerId)
        ),
      });

      return {
        provider,
        connection: defaultConn || null,
      };
    }),

  create: publicProcedure
    .input(
      z.object({
        provider: CloudProviderEnum,
        displayName: z.string().optional(),
        projectId: z.string().uuid().optional(),
        roleArn: z.string().optional(),
        externalId: z.string().optional(),
        tenantId: z.string().optional(),
        clientId: z.string().optional(),
        subscriptionId: z.string().optional(),
        resourceGroup: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id || "550e8400-e29b-41d4-a716-446655440000";
      const id = randomUUID();

      const newConnection = {
        id,
        userId,
        projectId: input.projectId || null,
        provider: input.provider,
        displayName: input.displayName || `${input.provider.toUpperCase()} Connection`,
        roleArn: input.roleArn || null,
        externalId: input.externalId || null,
        tenantId: input.tenantId || null,
        clientId: input.clientId || null,
        clientSecretRef: null,
        subscriptionId: input.subscriptionId || null,
        resourceGroup: input.resourceGroup || null,
        status: "connected" as const,
        connectedAt: new Date(),
        expiresAt:
          input.provider === "azure"
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      };

      if (process.env["DATABASE_URL"]) {
        await db.insert(cloudConnections).values(newConnection);
      }

      return newConnection;
    }),

  verify: publicProcedure
    .input(
      z.object({
        provider: CloudProviderEnum,
        roleArn: z.string().optional(),
        externalId: z.string().optional(),
        tenantId: z.string().optional(),
        clientId: z.string().optional(),
        subscriptionId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const adapter = createCloudAdapter(input.provider, {
        roleArn: input.roleArn,
        externalId: input.externalId,
        tenantId: input.tenantId,
        clientId: input.clientId,
        subscriptionId: input.subscriptionId,
      });

      const authRes = await adapter.authenticate();
      return authRes;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      if (process.env["DATABASE_URL"]) {
        await db.delete(cloudConnections).where(eq(cloudConnections.id, input.id));
      }
      return { success: true };
    }),
});
