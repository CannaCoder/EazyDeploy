import { describe, it, expect } from "vitest";
import {
  UserSchema,
  CreateUserSchema,
  ProjectSchema,
  CreateProjectSchema,
  ServiceSchema,
  ServiceTypeEnum,
  DeploymentSchema,
  DeploymentStatusEnum,
  ConflictCheckSchema,
  ConflictCheckStatusEnum,
  AuditLogSchema,
} from "../index.js";

describe("UserSchema", () => {
  it("validates a valid user object", () => {
    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      clerkId: "user_2test123",
      githubId: 123456,
      email: "developer@shipora.dev",
      name: "Alex Dev",
      avatarUrl: "https://github.com/alex.png",
      createdAt: new Date(),
    };
    const parsed = UserSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and missing clerkId", () => {
    const invalid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      clerkId: "",
      email: "not-an-email",
    };
    const parsed = UserSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("CreateUserSchema allows omitting id and createdAt", () => {
    const input = {
      clerkId: "user_abc",
      email: "hello@shipora.dev",
    };
    const parsed = CreateUserSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });
});

describe("ProjectSchema", () => {
  it("validates a complete project object", () => {
    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      ownerId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Acme Platform",
      githubRepoOwner: "acme-corp",
      githubRepoName: "platform",
      githubInstallationId: 987654,
      productionBranch: "main",
      createdAt: new Date(),
    };
    const parsed = ProjectSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-positive githubInstallationId", () => {
    const invalid = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      ownerId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Acme",
      githubRepoOwner: "acme",
      githubRepoName: "repo",
      githubInstallationId: -1,
    };
    const parsed = ProjectSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("ServiceSchema", () => {
  it("validates supported service types", () => {
    const types = ["nextjs", "vite", "node", "fastapi", "docker"] as const;
    types.forEach((type) => {
      const valid = {
        id: "550e8400-e29b-41d4-a716-446655440002",
        projectId: "550e8400-e29b-41d4-a716-446655440001",
        name: `service-${type}`,
        type,
        rootPath: `apps/${type}`,
        port: 3000,
      };
      const parsed = ServiceSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });

  it("rejects unsupported service type", () => {
    const invalid = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      projectId: "550e8400-e29b-41d4-a716-446655440001",
      name: "invalid-svc",
      type: "unsupported_framework",
      rootPath: "apps/invalid",
    };
    const parsed = ServiceSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("DeploymentSchema", () => {
  it("validates all deployment statuses", () => {
    const statuses = ["pending", "building", "deploying", "success", "failed", "rolled_back"] as const;
    statuses.forEach((status) => {
      const valid = {
        id: "550e8400-e29b-41d4-a716-446655440003",
        projectId: "550e8400-e29b-41d4-a716-446655440001",
        commitSha: "abc1234def5678",
        branch: "main",
        status,
      };
      const parsed = DeploymentSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });
});

describe("ConflictCheckSchema", () => {
  it("validates failureDetails structure", () => {
    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440004",
      projectId: "550e8400-e29b-41d4-a716-446655440001",
      commitSha: "abc1234",
      branch: "main",
      status: "failed",
      mergeConflicts: true,
      failureDetails: [
        {
          type: "merge_conflict",
          message: "Conflict detected in package.json",
          files: ["package.json"],
        },
      ],
    };
    const parsed = ConflictCheckSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

describe("AuditLogSchema", () => {
  it("validates audit log entry", () => {
    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440005",
      event: "project.created",
      metadata: { repo: "acme/api", branch: "main" },
    };
    const parsed = AuditLogSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
