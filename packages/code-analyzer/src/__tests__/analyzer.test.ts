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
});
