import { describe, it, expect } from "vitest";
import { buildContainerActivity } from "../activities/build-container.js";
import { syncSecretsActivity } from "../activities/sync-secrets.js";
import { provisionECSActivity } from "../activities/provision-ecs.js";
import { attachLoadBalancerActivity } from "../activities/attach-load-balancer.js";
import {
  buildImageActivity,
  pushSecretsActivity,
  provisionServiceActivity,
  configureIngressActivity,
  resolveCloudAdapterActivity,
  deployStaticSiteActivity,
} from "../activities/index.js";

describe("Temporal Worker Deploy Activities (Phase 3 & Phase 3.5)", () => {
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
    expect(result.taskEnvSecretRefs?.[0]?.name).toBe("DATABASE_URL");
    expect(result.taskEnvSecretRefs?.[0]?.valueFrom).toContain("DATABASE_URL::");
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

  describe("Phase 3.5 Cloud-Agnostic Deploy Activities", () => {
    it("resolveCloudAdapterActivity returns default provider in test mode", async () => {
      const res = await resolveCloudAdapterActivity({ projectId: "proj-123" });
      expect(res.provider).toBe("aws");
    });

    it("buildImageActivity supports Azure provider", async () => {
      const res = await buildImageActivity({
        projectId: "proj-azure-123",
        deploymentId: "dep-test-001",
        serviceName: "web",
        rootPath: "apps/web",
        commitSha: "f1e2d3c4b5a6",
        branch: "main",
        repoOwner: "acme",
        repoName: "azure-app",
        installationId: 112233,
        cloudProvider: "azure",
      });

      expect(res.success).toBe(true);
      expect(res.serviceName).toBe("web");
      expect(res.imageUri).toContain("azurecr.io");
    });

    it("pushSecretsActivity supports Azure Key Vault references", async () => {
      const res = await pushSecretsActivity({
        projectId: "proj-azure-123",
        deploymentId: "dep-test-001",
        serviceName: "api",
        detectedEnvVars: ["DATABASE_URL"],
        cloudProvider: "azure",
      });

      expect(res.success).toBe(true);
      expect(res.secretVaultId).toContain("vault.azure.net");
      expect(res.secretRefs[0]?.reference).toContain("vault.azure.net/secrets/");
    });

    it("provisionServiceActivity provisions Azure Container App", async () => {
      const res = await provisionServiceActivity({
        projectId: "proj-azure-123",
        deploymentId: "dep-test-001",
        serviceName: "web",
        serviceType: "nextjs",
        port: 3000,
        imageUri: "shiporacr.azurecr.io/web:latest",
        cloudProvider: "azure",
      });

      expect(res.success).toBe(true);
      expect(res.serviceName).toBe("web");
      expect(res.cloudServiceId).toContain("Microsoft.App/containerApps");
    });

    it("configureIngressActivity returns Azure Container App FQDN", async () => {
      const res = await configureIngressActivity({
        projectId: "proj-azure-123",
        deploymentId: "dep-test-001",
        serviceName: "web",
        port: 3000,
        cloudServiceId: "/subscriptions/123/resourceGroups/rg/providers/Microsoft.App/containerApps/web",
        domainPrefix: "web-azure-app",
        cloudProvider: "azure",
      });

      expect(res.success).toBe(true);
      expect(res.serviceUrl).toContain("azurecontainerapps.io");
    });

    it("deployStaticSiteActivity uploads assets to S3 and returns CloudFront CDN URL", async () => {
      const res = await deployStaticSiteActivity({
        projectId: "proj-static-123",
        deploymentId: "dep-static-001",
        serviceName: "portfolio",
        rootPath: ".",
        repoOwner: "acme",
        repoName: "my-portfolio",
        commitSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        branch: "main",
        installationId: 123456,
        cloudProvider: "aws",
      });

      expect(res.success).toBe(true);
      expect(res.serviceName).toBe("portfolio");
      expect(res.bucketName).toContain("proj-static-123");
      expect(res.distributionId).toBeDefined();
      expect(res.serviceUrl).toMatch(/^https?:\/\//);
      expect(res.releasePrefix).toBe("releases/dep-static-001");
    });
  });
});

