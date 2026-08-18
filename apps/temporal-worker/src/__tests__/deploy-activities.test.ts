import { describe, it, expect } from "vitest";
import { buildContainerActivity } from "../activities/build-container.js";
import { syncSecretsActivity } from "../activities/sync-secrets.js";
import { provisionECSActivity } from "../activities/provision-ecs.js";
import { attachLoadBalancerActivity } from "../activities/attach-load-balancer.js";

describe("Temporal Worker Deploy Activities (Phase 3)", () => {
  it("buildContainerActivity returns simulated build result in test/dev mode", async () => {
    const result = await buildContainerActivity({
      projectId: "proj-12345",
      serviceName: "web",
      rootPath: "apps/web",
      commitSha: "a1b2c3d4e5f6",
      branch: "main",
      repoOwner: "acme",
      repoName: "myapp",
      installationId: 987654,
    });

    expect(result.success).toBe(true);
    expect(result.serviceName).toBe("web");
    expect(result.imageUri).toContain("web-a1b2c3d");
    expect(result.buildId).toBeDefined();
  });

  it("syncSecretsActivity resolves taskEnvSecretRefs with valueFrom ARN strings", async () => {
    const result = await syncSecretsActivity({
      projectId: "proj-12345",
      serviceName: "api",
      detectedEnvVars: ["DATABASE_URL", "JWT_SECRET", "PORT"],
    });

    expect(result.success).toBe(true);
    expect(result.secretArn).toBeDefined();
    expect(result.taskEnvSecretRefs).toHaveLength(3);
    expect(result.taskEnvSecretRefs[0]?.name).toBe("DATABASE_URL");
    expect(result.taskEnvSecretRefs[0]?.valueFrom).toContain("DATABASE_URL::");
  });

  it("provisionECSActivity registers Task Definition and creates ECS Service ARN", async () => {
    const result = await provisionECSActivity({
      projectId: "proj-12345",
      serviceName: "web",
      serviceType: "nextjs",
      port: 3000,
      imageUri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/shipora-services:web-a1b2c3d",
      taskEnvSecretRefs: [
        {
          name: "DATABASE_URL",
          valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:shipora/projects/proj-12345/env:DATABASE_URL::",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.serviceName).toBe("web");
    expect(result.taskDefinitionArn).toContain("task-definition/shipora-web");
    expect(result.ecsServiceArn).toContain("service/shipora-cluster/shipora-web-svc");
  });

  it("attachLoadBalancerActivity provisions Target Group and Subdomain URL", async () => {
    const result = await attachLoadBalancerActivity({
      projectId: "proj-12345",
      serviceName: "api",
      port: 4000,
      ecsServiceArn: "arn:aws:ecs:us-east-1:123456789012:service/shipora-cluster/shipora-api-svc",
      domainPrefix: "api-myapp",
    });

    expect(result.success).toBe(true);
    expect(result.serviceName).toBe("api");
    expect(result.targetGroupArn).toBeDefined();
    expect(result.serviceUrl).toBe("https://api-myapp.shipora.app");
  });
});
