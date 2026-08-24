import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("Cloud Connect & Multi-Cloud API Endpoints (Phase 3.5)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("AWS CloudFormation Connect REST Endpoints", () => {
    it("POST /cloud-connect/aws/generate-cf-url generates CloudFormation one-click URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/cloud-connect/aws/generate-cf-url",
        payload: { region: "us-east-1" },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.url).toContain("console.aws.amazon.com/cloudformation/home");
      expect(data.url).toContain("ShiporaDeployRole");
      expect(data.externalId).toMatch(/^shipora-/);
    });

    it("POST /cloud-connect/aws/verify validates and stores IAM role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/cloud-connect/aws/verify",
        payload: {
          roleArn: "arn:aws:iam::123456789012:role/ShiporaDeployRole-12345",
          externalId: "shipora-ext-12345",
          displayName: "My Test AWS Account",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.connection.provider).toBe("aws");
      expect(data.connection.displayName).toBe("My Test AWS Account");
    });

    it("GET /cloud-connect/connections returns user's connected clouds", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/cloud-connect/connections",
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.connections)).toBe(true);
    });
  });

  describe("Azure OAuth & Verify REST Endpoints", () => {
    it("GET /auth/azure/start returns Azure AD OAuth 2.0 authorization URL", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/azure/start",
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.authUrl).toContain("login.microsoftonline.com/");
      expect(data.authUrl).toContain("/oauth2/v2.0/authorize");
      expect(data.authUrl).toContain("management.azure.com");
    });

    it("POST /auth/azure/verify validates Azure credentials", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/azure/verify",
        payload: {
          tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
          clientId: "98765432-1234-4321-abcd-1234567890ab",
          subscriptionId: "c8b2d194-e812-4d22-b5e0-827038167389",
          resourceGroup: "shipora-rg",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.identityArn).toContain("servicePrincipals");
    });
  });

  describe("tRPC cloudConnection Router", () => {
    it("cloudConnection.list returns list of connections", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/trpc/cloudConnection.list",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.result.data)).toBe(true);
    });

    it("cloudConnection.verify tests cloud provider authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/trpc/cloudConnection.verify",
        payload: {
          provider: "azure",
          tenantId: "tenant-123",
          clientId: "client-456",
          subscriptionId: "sub-789",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.result.data.success).toBe(true);
    });
  });
});
