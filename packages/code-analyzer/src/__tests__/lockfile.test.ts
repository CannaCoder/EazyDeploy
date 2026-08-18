import { describe, it, expect } from "vitest";
import { scanLockfileHealth } from "../scanners/lockfile.js";

describe("scanLockfileHealth", () => {
  it("passes when package.json has a matching pnpm-lock.yaml", () => {
    const files = [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            fastify: "^4.28.1",
          },
        }),
      },
      {
        path: "pnpm-lock.yaml",
        content: `
          lockfileVersion: '9.0'
          importers:
            .:
              dependencies:
                fastify:
                  specifier: ^4.28.1
                  version: 4.28.1
        `,
      },
    ];

    const result = scanLockfileHealth(files);
    expect(result.isHealthy).toBe(true);
    expect(result.lockfileType).toBe("pnpm");
    expect(result.issues).toHaveLength(0);
  });

  it("flags missing lockfile when package.json exists without lockfile", () => {
    const files = [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            express: "^4.19.2",
          },
        }),
      },
    ];

    const result = scanLockfileHealth(files);
    expect(result.isHealthy).toBe(false);
    expect(result.issues[0]).toContain("Missing lockfile");
  });

  it("flags missing dependency from lockfile", () => {
    const files = [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            fastify: "^4.28.1",
            "missing-pkg": "^1.0.0",
          },
        }),
      },
      {
        path: "pnpm-lock.yaml",
        content: `
          lockfileVersion: '9.0'
          dependencies:
            fastify: 4.28.1
        `,
      },
    ];

    const result = scanLockfileHealth(files);
    expect(result.isHealthy).toBe(false);
    expect(result.issues.some((i) => i.includes("missing-pkg"))).toBe(true);
  });
});
