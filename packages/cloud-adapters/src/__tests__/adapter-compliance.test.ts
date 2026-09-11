import { describe, it, expect } from "vitest";
import { AwsAdapter, AzureAdapter, DigitalOceanAdapter, GcpAdapter, createCloudAdapter } from "../index.js";

describe("CloudProviderAdapter Compliance Suite", () => {
  const adapters = [
    { name: "AwsAdapter", instance: new AwsAdapter() },
    { name: "AzureAdapter", instance: new AzureAdapter() },
    { name: "DigitalOceanAdapter", instance: new DigitalOceanAdapter() },
    { name: "GcpAdapter", instance: new GcpAdapter() },
  ];

  adapters.forEach(({ name, instance }) => {
    describe(name, () => {
      it("authenticates successfully", async () => {
        const res = await instance.authenticate();
        expect(res.success).toBe(true);
        expect(res.identityArn).toBeDefined();
      });

      it("builds container image from source config", async () => {
        const res = await instance.buildImage({
          projectId: "proj-12345",
          serviceName: "web",
          rootPath: "apps/web",
          commitSha: "a1b2c3d4e5f6",
          branch: "main",
          repoOwner: "acme",
          repoName: "myapp",
          installationId: 987654,
        });

        expect(res.success).toBe(true);
        expect(res.serviceName).toBe("web");
        expect(res.imageUri).toContain("web-a1b2c3d");
      });

      it("pushes and resolves secrets", async () => {
        const res = await instance.pushSecrets({
          projectId: "proj-12345",
          serviceName: "api",
          detectedEnvVars: ["DATABASE_URL", "JWT_SECRET"],
        });

        expect(res.success).toBe(true);
        expect(res.injectedKeys).toEqual(["DATABASE_URL", "JWT_SECRET"]);
        expect(res.secretRefs.length).toBe(2);
        expect(res.secretRefs[0]?.name).toBe("DATABASE_URL");
        expect(res.secretRefs[0]?.reference).toBeDefined();
      });

      it("provisions compute service workload", async () => {
        const res = await instance.provisionService({
          projectId: "proj-12345",
          serviceName: "web",
          serviceType: "nextjs",
          port: 3000,
          imageUri: "registry.io/shipora/web:latest",
          secretRefs: [{ name: "DATABASE_URL", reference: "vault:db_url" }],
        });

        expect(res.success).toBe(true);
        expect(res.serviceName).toBe("web");
        expect(res.cloudServiceId).toBeDefined();
        expect(res.currentRevision).toBeDefined();
      });

      it("configures ingress routing and HTTPS", async () => {
        const res = await instance.configureIngress({
          projectId: "proj-12345",
          serviceName: "web",
          port: 3000,
          cloudServiceId: "cloud-svc-123",
          domainPrefix: "web-myapp",
        });

        expect(res.success).toBe(true);
        expect(res.serviceName).toBe("web");
        expect(res.serviceUrl).toMatch(/^https:\/\//);
      });

      it("reads running deployment status", async () => {
        const res = await instance.getDeploymentStatus({
          projectId: "proj-12345",
          serviceName: "web",
          cloudServiceId: "cloud-svc-123",
        });

        expect(res.status).toBe("running");
        expect(res.healthy).toBe(true);
        expect(res.replicaCount).toBeGreaterThanOrEqual(1);
      });

      it("performs resource teardown", async () => {
        const res = await instance.teardown({
          projectId: "proj-12345",
          serviceNames: ["web", "api"],
        });

        expect(res.success).toBe(true);
        expect(res.deletedResources.length).toBeGreaterThan(0);
      });

      it("deploys static site assets and returns live preview URL", async () => {
        const res = await instance.deployStaticSite!({
          projectId: "proj-12345",
          serviceName: "landing",
          deploymentId: "dep-abc1234",
          files: [
            { path: "index.html", content: "<h1>Hello World</h1>" },
            { path: "style.css", content: "body { margin: 0; }" },
          ],
        });

        expect(res.success).toBe(true);
        expect(res.serviceName).toBe("landing");
        expect(res.bucketName).toBeDefined();
        expect(res.distributionId).toBeDefined();
        expect(res.serviceUrl).toMatch(/^https?:\/\//);
        expect(res.releasePrefix).toBe("releases/dep-abc1234");
      });

      it("rolls back static site CDN distribution", async () => {
        const res = await instance.rollbackStaticSite!({
          projectId: "proj-12345",
          serviceName: "landing",
          bucketName: "shipora-static-proj-12345",
          distributionId: "E12345EXAMPLE",
          previousReleasePrefix: "releases/dep-prev9999",
        });

        expect(res.success).toBe(true);
        expect(res.serviceName).toBe("landing");
        expect(res.serviceUrl).toMatch(/^https?:\/\//);
      });
    });
  });

  describe("Adapter Factory", () => {
    it("creates AwsAdapter when provider is aws", () => {
      const adapter = createCloudAdapter("aws");
      expect(adapter.provider).toBe("aws");
      expect(adapter).toBeInstanceOf(AwsAdapter);
    });

    it("creates AzureAdapter when provider is azure", () => {
      const adapter = createCloudAdapter("azure");
      expect(adapter.provider).toBe("azure");
      expect(adapter).toBeInstanceOf(AzureAdapter);
    });

    it("creates DigitalOceanAdapter when provider is digitalocean", () => {
      const adapter = createCloudAdapter("digitalocean");
      expect(adapter.provider).toBe("digitalocean");
      expect(adapter).toBeInstanceOf(DigitalOceanAdapter);
    });

    it("creates GcpAdapter when provider is gcp", () => {
      const adapter = createCloudAdapter("gcp");
      expect(adapter.provider).toBe("gcp");
      expect(adapter).toBeInstanceOf(GcpAdapter);
    });

    it("throws for unsupported provider", () => {
      expect(() => createCloudAdapter("unsupported" as any)).toThrow("Unsupported");
    });
  });
});
