import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("GitHub Installation & Verification Endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /github/app-info returns app configuration status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/github/app-info",
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty("configured");
  });

  it("GET /github/install-url returns valid GitHub App installation URL", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/github/install-url",
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.url).toContain("github.com/apps/");
    expect(data.url).toContain("/installations/new");
  });

  it("POST /github/verify-repo validates repository format", async () => {
    const invalidRes = await app.inject({
      method: "POST",
      url: "/github/verify-repo",
      payload: { repo: "invalid-single-word" },
    });

    expect(invalidRes.statusCode).toBe(400);
    const invalidData = JSON.parse(invalidRes.body);
    expect(invalidData.success).toBe(false);
  });

  it("POST /github/verify-repo fetches real public repository data", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/github/verify-repo",
      payload: { repo: "facebook/react" },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.repository.name).toBe("react");
    expect(data.repository.owner).toBe("react");
    expect(data.repository.defaultBranch).toBe("main");
    expect(Array.isArray(data.repository.branches)).toBe(true);
    expect(data.repository.branches.length).toBeGreaterThan(0);
  });

  it("POST /github/verify-token validates empty token gracefully", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/github/verify-token",
      payload: { token: "" },
    });

    expect(res.statusCode).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
  });
});
