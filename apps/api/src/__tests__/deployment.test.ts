import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("tRPC deployment Router & Project Secrets", () => {
  let app: FastifyInstance;
  const authHeaders = {
    authorization: "Bearer test_user_developer_1",
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("deployment.list returns deployments array for a project", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trpc/deployment.list?input=${encodeURIComponent(
        JSON.stringify({ projectId: "00000000-0000-0000-0000-000000000001" })
      )}`,
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.result.data)).toBe(true);
  });

  it("deployment.trigger creates a new deployment and returns workflow ID", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/trpc/deployment.trigger",
      headers: authHeaders,
      payload: {
        projectId: "00000000-0000-0000-0000-000000000001",
        commitSha: "abc1234567890",
        branch: "main",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data).toBeDefined();
    expect(body.result.data.status).toBe("building");
    expect(body.result.data.commitSha).toBe("abc1234567890");
  });

  it("deployment.getById returns deployment details with services", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trpc/deployment.getById?input=${encodeURIComponent(
        JSON.stringify({ id: "00000000-0000-0000-0000-000000000001" })
      )}`,
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data).toBeDefined();
    expect(body.result.data.id).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("project.saveSecrets saves env string and returns key count", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/trpc/project.saveSecrets",
      headers: authHeaders,
      payload: {
        projectId: "00000000-0000-0000-0000-000000000001",
        rawEnv: "DATABASE_URL=postgres://localhost:5432/db\nAPI_KEY=secret_12345",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data.success).toBe(true);
    expect(body.result.data.keyCount).toBe(2);
    expect(body.result.data.keys).toContain("DATABASE_URL");
    expect(body.result.data.keys).toContain("API_KEY");
  });

  it("project.getSecretKeys returns list of configured key names", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trpc/project.getSecretKeys?input=${encodeURIComponent(
        JSON.stringify({ projectId: "00000000-0000-0000-0000-000000000001" })
      )}`,
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.result.data.keys)).toBe(true);
  });
});
