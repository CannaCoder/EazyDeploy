import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  users,
  projects,
  services,
  deployments,
  conflictChecks,
  auditLogs,
  cloudConnections,
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
    expect(cols).toHaveProperty("cloudProvider");
    expect(cols).toHaveProperty("cloudConnectionId");
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
    expect(cols).toHaveProperty("cloudServiceId");
    expect(cols).toHaveProperty("currentRevision");
    expect(cols).toHaveProperty("previousRevision");
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

  it("defines cloud_connections table with AWS and Azure columns", () => {
    const cols = getTableColumns(cloudConnections);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("userId");
    expect(cols).toHaveProperty("projectId");
    expect(cols).toHaveProperty("provider");
    expect(cols).toHaveProperty("displayName");
    expect(cols).toHaveProperty("roleArn");
    expect(cols).toHaveProperty("externalId");
    expect(cols).toHaveProperty("tenantId");
    expect(cols).toHaveProperty("clientId");
    expect(cols).toHaveProperty("clientSecretRef");
    expect(cols).toHaveProperty("subscriptionId");
    expect(cols).toHaveProperty("resourceGroup");
    expect(cols).toHaveProperty("status");
    expect(cols).toHaveProperty("connectedAt");
    expect(cols).toHaveProperty("expiresAt");
    expect(cols).toHaveProperty("lastUsedAt");
  });
});

