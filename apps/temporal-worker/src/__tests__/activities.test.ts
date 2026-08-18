import { describe, it, expect, vi } from "vitest";
import { validateEnvVarsActivity } from "../activities/validate-env-vars.js";
import { scanMergeConflictsActivity } from "../activities/scan-merge-conflicts.js";
import { scanLockfileHealthActivity } from "../activities/scan-lockfile-health.js";

describe("Temporal Worker Activities", () => {
  it("validateEnvVarsActivity handles development mode gracefully", async () => {
    const result = await validateEnvVarsActivity(
      {
        projectId: "test-proj-123",
        repoOwner: "test-org",
        repoName: "test-repo",
        commitSha: "abc1234",
        branch: "main",
        installationId: 123456,
      },
      ["DATABASE_URL", "CLERK_SECRET_KEY"]
    );

    expect(result).toBeDefined();
    expect(result.detected).toContain("DATABASE_URL");
    expect(result.detected).toContain("CLERK_SECRET_KEY");
  });

  it("scanMergeConflictsActivity returns passed: true in fallback mode", async () => {
    const result = await scanMergeConflictsActivity({
      projectId: "test-proj-123",
      repoOwner: "mock-org",
      repoName: "mock-repo",
      commitSha: "abc1234",
      branch: "main",
      installationId: 123456,
    });

    expect(result.passed).toBe(true);
    expect(result.conflictingFiles).toEqual([]);
  });

  it("scanLockfileHealthActivity returns passed: true in fallback mode", async () => {
    const result = await scanLockfileHealthActivity({
      projectId: "test-proj-123",
      repoOwner: "mock-org",
      repoName: "mock-repo",
      commitSha: "abc1234",
      branch: "main",
      installationId: 123456,
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
