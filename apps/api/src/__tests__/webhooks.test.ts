import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { buildApp } from "../app.js";

describe("GitHub Webhook Route", () => {
  let app: FastifyInstance;
  const webhookSecret = "test-webhook-secret";

  beforeAll(async () => {
    process.env["GITHUB_APP_WEBHOOK_SECRET"] = webhookSecret;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when signature header is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: { action: "push" },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toContain("Missing x-hub-signature-256");
  });

  it("returns 401 when signature is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-hub-signature-256": "sha256=invalidhexstring",
      },
      payload: { action: "push" },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toContain("Invalid webhook signature");
  });

  it("returns 202 when signature matches payload", async () => {
    const payloadStr = JSON.stringify({
      ref: "refs/heads/main",
      repository: { name: "demo", full_name: "test/demo" },
    });

    const signature = `sha256=${crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadStr)
      .digest("hex")}`;

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "push",
      },
      payload: payloadStr,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.received).toBe(true);
    expect(body.event).toBe("push");
  });
});
