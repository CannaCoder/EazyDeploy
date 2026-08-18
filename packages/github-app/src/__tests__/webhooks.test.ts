import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { validateWebhookSignature, parsePushPayload } from "../index.js";

describe("validateWebhookSignature", () => {
  const secret = "super-secret-webhook-key";
  const payload = JSON.stringify({ action: "push", ref: "refs/heads/main" });

  it("returns true for a matching HMAC-SHA256 signature", () => {
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")}`;

    const isValid = validateWebhookSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it("returns false if signature does not match payload", () => {
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")}`;

    const tamperedPayload = JSON.stringify({ action: "push", ref: "refs/heads/staging" });
    const isValid = validateWebhookSignature(tamperedPayload, signature, secret);
    expect(isValid).toBe(false);
  });

  it("returns false if signature or secret is missing", () => {
    expect(validateWebhookSignature(payload, undefined, secret)).toBe(false);
    expect(validateWebhookSignature(payload, "sha256=123", "")).toBe(false);
  });
});

describe("parsePushPayload", () => {
  it("parses valid push event payload", () => {
    const raw = {
      ref: "refs/heads/main",
      before: "000000",
      after: "111111",
      repository: {
        id: 1,
        name: "shipora-demo",
        full_name: "user/shipora-demo",
        owner: { login: "user", id: 10 },
        default_branch: "main",
      },
      installation: { id: 12345 },
    };

    const parsed = parsePushPayload(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.repository.name).toBe("shipora-demo");
    expect(parsed?.installation?.id).toBe(12345);
  });

  it("returns null for non-push payload", () => {
    expect(parsePushPayload(null)).toBeNull();
    expect(parsePushPayload("string")).toBeNull();
    expect(parsePushPayload({ foo: "bar" })).toBeNull();
  });
});
