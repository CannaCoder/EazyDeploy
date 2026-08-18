import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  users,
  projects,
  services,
  deployments,
  conflictChecks,
  auditLogs,
} from "../index.js";

describe("Database Schema Definitions", () => {
  it("defines users table with all expected columns", () => {
    const cols = getTableColumns(users);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("clerkId");
    expect(cols).toHaveProperty("githubId");
    expect(cols).toHaveProperty("email");
    expect(cols).toHaveProperty("name");
    expect(cols).toHaveProperty("avatarUrl");
    expect(cols).toHaveProperty("createdAt");
  });

  it("defines projects table with foreign key and branch defaults", () => {
    const cols = getTableColumns(projects);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("ownerId");
    expect(cols).toHaveProperty("name");
    expect(cols).toHaveProperty("githubRepoOwner");
    expect(cols).toHaveProperty("githubRepoName");
    expect(cols).toHaveProperty("githubInstallationId");
    expect(cols).toHaveProperty("productionBranch");
    expect(cols).toHaveProperty("envSecretArn");
  });

  it("defines services table with service tracking columns", () => {
    const cols = getTableColumns(services);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("projectId");
    expect(cols).toHaveProperty("name");
    expect(cols).toHaveProperty("type");
    expect(cols).toHaveProperty("rootPath");
    expect(cols).toHaveProperty("port");
    expect(cols).toHaveProperty("buildCommand");
    expect(cols).toHaveProperty("ecsServiceArn");
  });

  it("defines deployments table with status and timing", () => {
    const cols = getTableColumns(deployments);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("projectId");
    expect(cols).toHaveProperty("commitSha");
    expect(cols).toHaveProperty("branch");
    expect(cols).toHaveProperty("status");
    expect(cols).toHaveProperty("startedAt");
    expect(cols).toHaveProperty("completedAt");
  });

  it("defines conflict_checks table with check flags and jsonb details", () => {
    const cols = getTableColumns(conflictChecks);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("projectId");
    expect(cols).toHaveProperty("status");
    expect(cols).toHaveProperty("mergeConflicts");
    expect(cols).toHaveProperty("lockfileHealthy");
    expect(cols).toHaveProperty("envVarsValid");
    expect(cols).toHaveProperty("failureDetails");
  });

  it("defines audit_logs table", () => {
    const cols = getTableColumns(auditLogs);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("projectId");
    expect(cols).toHaveProperty("actorId");
    expect(cols).toHaveProperty("event");
    expect(cols).toHaveProperty("metadata");
  });
});
