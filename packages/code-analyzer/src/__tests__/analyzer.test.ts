import { describe, it, expect } from "vitest";
import { analyzeRepository } from "../analyzer.js";

describe("analyzeRepository", () => {
  it("detects monorepo services and environment variables end-to-end", async () => {
    const files = [
      {
        path: "apps/web/next.config.js",
        content: "module.exports = {};",
      },
      {
        path: "apps/web/src/page.tsx",
        content: "const api = process.env.NEXT_PUBLIC_API_URL;",
      },
      {
        path: "apps/api/package.json",
        content: JSON.stringify({ dependencies: { fastify: "^4.0.0" } }),
      },
      {
        path: "apps/api/src/index.ts",
        content: "const db = process.env.DATABASE_URL;",
      },
      {
        path: "package.json",
        content: JSON.stringify({ name: "my-monorepo" }),
      },
      {
        path: "pnpm-lock.yaml",
        content: "lockfileVersion: '9.0'",
      },
    ];

    const result = await analyzeRepository(files);

    expect(result.services).toHaveLength(2);
    expect(result.services.map((s) => s.name)).toContain("web");
    expect(result.services.map((s) => s.name)).toContain("api");
    expect(result.detectedEnvVars).toContain("NEXT_PUBLIC_API_URL");
    expect(result.detectedEnvVars).toContain("DATABASE_URL");
    expect(result.hasMergeConflicts).toBe(false);
    expect(result.isLockfileHealthy).toBe(true);
  });

  it("detects pure static website (HTML/CSS/JS) with no env or backend", async () => {
    const files = [
      {
        path: "index.html",
        content: "<!DOCTYPE html><html><head><title>My Static App</title></head><body><h1>Hello</h1></body></html>",
      },
      {
        path: "styles/style.css",
        content: "body { background: #000; color: #fff; }",
      },
      {
        path: "scripts/app.js",
        content: "console.log('App loaded');",
      },
    ];

    const result = await analyzeRepository(files);

    expect(result.services).toHaveLength(1);
    expect(result.services[0]!.name).toBe("main");
    expect(result.services[0]!.type).toBe("static");
    expect(result.services[0]!.port).toBe(80);
    expect(result.services[0]!.buildCommand).toBeUndefined();
    expect(result.detectedEnvVars).toHaveLength(0);
    expect(result.hasMergeConflicts).toBe(false);
  });
});
