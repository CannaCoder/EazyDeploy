import { describe, it, expect } from "vitest";
import { detectEnvironmentVariables } from "../detectors/env.js";

describe("detectEnvironmentVariables", () => {
  it("detects process.env variables in TypeScript and JavaScript", () => {
    const files = [
      {
        path: "apps/api/src/config.ts",
        content: `
          const dbUrl = process.env.DATABASE_URL;
          const secret = process.env['CLERK_SECRET_KEY'];
          const apiKey = process.env["TEMPORAL_API_KEY"];
        `,
      },
    ];

    const result = detectEnvironmentVariables(files);
    expect(result).toContain("DATABASE_URL");
    expect(result).toContain("CLERK_SECRET_KEY");
    expect(result).toContain("TEMPORAL_API_KEY");
  });

  it("detects Vite import.meta.env variables", () => {
    const files = [
      {
        path: "apps/web/src/main.tsx",
        content: `
          const apiUrl = import.meta.env.VITE_API_URL;
          const clientKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"];
        `,
      },
    ];

    const result = detectEnvironmentVariables(files);
    expect(result).toContain("VITE_API_URL");
    expect(result).toContain("VITE_CLERK_PUBLISHABLE_KEY");
  });

  it("detects Python os.environ and os.getenv variables", () => {
    const files = [
      {
        path: "services/ml/app.py",
        content: `
          import os
          redis_url = os.environ["REDIS_URL"]
          openai_key = os.getenv("OPENAI_API_KEY")
          s3_bucket = os.environ.get("S3_BUCKET_NAME")
        `,
      },
    ];

    const result = detectEnvironmentVariables(files);
    expect(result).toContain("REDIS_URL");
    expect(result).toContain("OPENAI_API_KEY");
    expect(result).toContain("S3_BUCKET_NAME");
  });

  it("ignores standard runtime variables like NODE_ENV and PORT", () => {
    const files = [
      {
        path: "index.ts",
        content: `
          const isDev = process.env.NODE_ENV === "development";
          const port = process.env.PORT || 3000;
        `,
      },
    ];

    const result = detectEnvironmentVariables(files);
    expect(result).not.toContain("NODE_ENV");
    expect(result).not.toContain("PORT");
  });
});
