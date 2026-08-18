import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("tRPC Endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("user.sync mutation successfully registers/syncs user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/trpc/user.sync",
      payload: {
        clerkId: "user_test_12345",
        email: "testuser@shipora.dev",
        name: "Test Developer",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data.clerkId).toBe("user_test_12345");
    expect(body.result.data.email).toBe("testuser@shipora.dev");
  });

  it("project.list returns 401 UNAUTHORIZED when no auth header provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trpc/project.list",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain("You must be signed in");
  });

  it("project.create and project.list work with authenticated bearer token", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/trpc/project.create",
      headers: {
        authorization: "Bearer test_user_developer_1",
      },
      payload: {
        name: "My Next.js & Fastify Monorepo",
        githubRepoOwner: "developer",
        githubRepoName: "my-monorepo",
        githubInstallationId: 987654,
        productionBranch: "main",
      },
    });

    expect(createRes.statusCode).toBe(200);
    const created = JSON.parse(createRes.body).result.data;
    expect(created.name).toBe("My Next.js & Fastify Monorepo");
    expect(created.githubRepoName).toBe("my-monorepo");

    // List projects
    const listRes = await app.inject({
      method: "GET",
      url: "/trpc/project.list",
      headers: {
        authorization: "Bearer test_user_developer_1",
      },
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body).result.data;
    expect(Array.isArray(list)).toBe(true);
  });
});
