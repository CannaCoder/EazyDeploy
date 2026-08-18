import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("tRPC conflictCheck Router", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("conflictCheck.list returns empty list for project without checks", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trpc/conflictCheck.list?input=${encodeURIComponent(
        JSON.stringify({ projectId: "00000000-0000-0000-0000-000000000001" })
      )}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.result.data)).toBe(true);
  });

  it("conflictCheck.getByCommit returns null for non-existent commit", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trpc/conflictCheck.getByCommit?input=${encodeURIComponent(
        JSON.stringify({
          projectId: "00000000-0000-0000-0000-000000000001",
          commitSha: "abc1234567890",
        })
      )}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data).toBeNull();
  });

  it("conflictCheck.retry initiates a check workflow", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/trpc/conflictCheck.retry",
      payload: {
        projectId: "00000000-0000-0000-0000-000000000001",
        commitSha: "abc1234567890",
        branch: "main",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.data.status).toBe("running");
  });
});
