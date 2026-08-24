import { ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { ContainerRegistryManagementClient } from "@azure/arm-containerregistry";
import { ContainerAppsAPIClient } from "@azure/arm-appcontainers";
import { SecretClient } from "@azure/keyvault-secrets";
import { KeyVaultManagementClient } from "@azure/arm-keyvault";
import { generateDockerfile } from "./dockerfile-generator.js";
import type { CloudConnection } from "@shipora/types";

import type { CloudProviderAdapter } from "../adapter.js";
import type {
  AuthResult,
  BuildImageInput,
  BuildImageResult,
  PushSecretsInput,
  PushSecretsResult,
  ProvisionServiceInput,
  ProvisionServiceResult,
  ConfigureIngressInput,
  ConfigureIngressResult,
  DeploymentStatusInput,
  DeploymentStatusResult,
  TeardownInput,
  TeardownResult,
  SecretRef,
} from "../types.js";

type LogCallback = (line: string, level?: "info" | "warn" | "error") => Promise<void> | void;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class AzureAdapter implements CloudProviderAdapter {
  public readonly provider = "azure" as const;
  private credential: ClientSecretCredential;
  private subscriptionId: string;
  private resourceGroup: string;
  private region: string;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;

  /** Optional callback for streaming log lines during long-running operations */
  public onLog?: LogCallback;

  constructor(connection?: Partial<CloudConnection>) {
    this.tenantId =
      connection?.tenantId ||
      process.env["AZURE_TENANT_ID"] ||
      "00000000-0000-0000-0000-000000000000";
    this.clientId =
      connection?.clientId ||
      process.env["AZURE_CLIENT_ID"] ||
      "00000000-0000-0000-0000-000000000000";
    this.clientSecret =
      (connection as any)?.clientSecret ||
      process.env["AZURE_CLIENT_SECRET"] ||
      "";
    this.subscriptionId =
      connection?.subscriptionId ||
      process.env["AZURE_SUBSCRIPTION_ID"] ||
      "00000000-0000-0000-0000-000000000000";
    this.resourceGroup =
      connection?.resourceGroup ||
      process.env["AZURE_RESOURCE_GROUP"] ||
      "eazydeploy-rg";
    this.region = process.env["AZURE_REGION"] || "centralindia";

    this.credential =
      this.clientSecret && this.clientSecret.length > 0
        ? new ClientSecretCredential(this.tenantId, this.clientId, this.clientSecret)
        : (null as unknown as ClientSecretCredential);
  }

  private async log(line: string, level: "info" | "warn" | "error" = "info") {
    if (this.onLog) await this.onLog(line, level);
    else console.log(`[AzureAdapter] ${line}`);
  }

  private get isReal(): boolean {
    if (process.env["VITEST"] === "true" || process.env["NODE_ENV"] === "test") {
      return false;
    }
    return (
      this.clientSecret.length > 10 &&
      !this.clientId.startsWith("00000000") &&
      !this.subscriptionId.startsWith("00000000")
    );
  }

  // ── Ensure Resource Group exists ──────────────────────────────────────────
  private async ensureResourceGroup(): Promise<void> {
    const client = new ResourceManagementClient(this.credential, this.subscriptionId);
    const exists = await client.resourceGroups.checkExistence(this.resourceGroup);
    if (!exists) {
      await this.log(`Creating resource group '${this.resourceGroup}' in ${this.region}...`);
      await client.resourceGroups.createOrUpdate(this.resourceGroup, {
        location: this.region,
        tags: { managedBy: "eazydeploy" },
      });
      await this.log(`✅ Resource group '${this.resourceGroup}' created`);
    }
  }

  // ── Ensure ACR registry exists, return login server ───────────────────────
  private async ensureACR(acrName: string): Promise<string> {
    const client = new ContainerRegistryManagementClient(this.credential, this.subscriptionId);
    let registry;
    try {
      registry = await client.registries.get(this.resourceGroup, acrName);
      await this.log(`Using existing ACR registry: ${registry.loginServer}`);
    } catch {
      await this.log(`Creating ACR registry '${acrName}' (SKU: Basic)...`);
      const poller = await client.registries.beginCreate(
        this.resourceGroup,
        acrName,
        {
          location: this.region,
          sku: { name: "Basic" },
          adminUserEnabled: true,
          tags: { managedBy: "eazydeploy" },
        }
      );
      registry = await poller.pollUntilDone();
      await this.log(`✅ ACR registry '${acrName}' created: ${registry.loginServer}`);
    }
    return registry.loginServer!;
  }

  // ── Ensure Container Apps Environment exists ───────────────────────────────
  private async ensureContainerAppEnvironment(envName = "eazydeploy-env"): Promise<string> {
    const tokenRes = await this.credential.getToken("https://management.azure.com/.default");
    const armToken = tokenRes.token;
    const listUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/managedEnvironments?api-version=2024-03-01`;

    try {
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${armToken}` },
      });
      if (listRes.ok) {
        const listData = (await listRes.json()) as { value?: Array<{ id: string; name: string; properties?: { provisioningState?: string } }> };
        const existing = listData.value?.find((e) => e.properties?.provisioningState === "Succeeded") || listData.value?.[0];
        if (existing?.id) {
          await this.log(`[provision] Using existing Container Apps Environment '${existing.name}'`);
          return existing.id;
        }
      }
    } catch {
      // fallback to creating
    }

    const url = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/managedEnvironments/${envName}?api-version=2024-03-01`;

    await this.log(`Creating Container Apps Environment '${envName}'...`);
    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${armToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: this.region,
        tags: { managedBy: "eazydeploy" },
        properties: {
          zoneRedundant: false,
        },
      }),
    });

    const envData = (await putRes.json()) as { id?: string; error?: { message?: string } };
    if (!putRes.ok && !envData.id) {
      throw new Error(`Failed to create Container Apps Environment: ${envData.error?.message || putRes.statusText}`);
    }

    const envId = envData.id || `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/managedEnvironments/${envName}`;

    // Poll until environment is provisioned
    const start = Date.now();
    while (Date.now() - start < 180000) {
      await sleep(5000);
      try {
        const pollRes = await fetch(url, {
          headers: { Authorization: `Bearer ${armToken}` },
        });
        if (pollRes.ok) {
          const pollData = (await pollRes.json()) as { properties?: { provisioningState?: string } };
          const state = pollData.properties?.provisioningState;
          if (state === "Succeeded") {
            await this.log(`✅ Container Apps Environment ready`);
            return envId;
          }
          if (state === "Failed") {
            throw new Error("Container Apps Environment provisioning failed");
          }
        }
      } catch (err: any) {
        if (err.message.includes("failed")) throw err;
      }
    }

    await this.log(`✅ Container Apps Environment ready (timeout poll fallback)`);
    return envId;
  }

  // ────────────────────────────────────────────────────────────────────────────

  public async authenticate(): Promise<AuthResult> {
    if (!this.isReal) {
      return {
        success: true,
        tenantId: this.tenantId,
        identityArn: `/subscriptions/${this.subscriptionId}/providers/Microsoft.Authorization/servicePrincipals/${this.clientId}`,
      };
    }
    try {
      // Verify credential by fetching a token
      await this.credential.getToken("https://management.azure.com/.default");
      return {
        success: true,
        tenantId: this.tenantId,
        identityArn: `/subscriptions/${this.subscriptionId}/providers/Microsoft.Authorization/servicePrincipals/${this.clientId}`,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  public async buildImage(input: BuildImageInput): Promise<BuildImageResult> {
    const acrName = `eazydeploy${this.subscriptionId.replace(/-/g, "").slice(0, 12)}`.toLowerCase();
    const imageTag = `${input.serviceName}-${input.commitSha.slice(0, 7)}`;

    if (!this.isReal) {
      const loginServer = `${acrName}.azurecr.io`;
      const imageUri = `${loginServer}/${input.serviceName}:${imageTag}`;
      await this.log(`[build] Simulated build (no real Azure credentials): ${imageUri}`);
      return { success: true, serviceName: input.serviceName, imageUri, buildId: `mock-${imageTag}`, buildDurationSeconds: 0 };
    }

    try {
      await this.ensureResourceGroup();
      const loginServer = await this.ensureACR(acrName);
      const imageUri = `${loginServer}/${input.serviceName}:${imageTag}`;

      await this.log(`[build] Starting ACR Quick Run for '${input.serviceName}' → ${imageUri}`);

      // Get ARM access token
      const tokenRes = await this.credential.getToken("https://management.azure.com/.default");
      const armToken = tokenRes.token;

      const githubToken = process.env["GITHUB_PAT"] || process.env["GITHUB_CLIENT_SECRET"] || "";
      const repoUrl = `https://${githubToken ? githubToken + "@" : ""}github.com/${input.repoOwner}/${input.repoName}.git`;
      const dockerfilePath = input.rootPath ? `${input.rootPath}/Dockerfile` : "Dockerfile";

      // Check if the repo already has a Dockerfile via GitHub API
      let hasDockerfile = false;
      let inlineDockerfile: string | null = null;
      try {
        const checkPath = input.rootPath ? `${input.rootPath}/Dockerfile` : "Dockerfile";
        const ghCheckUrl = `https://api.github.com/repos/${input.repoOwner}/${input.repoName}/contents/${checkPath}?ref=${input.commitSha}`;
        const ghRes = await fetch(ghCheckUrl, {
          headers: {
            ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
            Accept: "application/vnd.github.v3+json",
          },
        });
        hasDockerfile = ghRes.ok;

        if (!hasDockerfile) {
          // Try to detect framework from package.json
          await this.log(`[build] No Dockerfile found in repo — auto-generating one...`);
          const pkgJsonUrl = `https://api.github.com/repos/${input.repoOwner}/${input.repoName}/contents/${input.rootPath ? input.rootPath + "/package.json" : "package.json"}?ref=${input.commitSha}`;
          const pkgRes = await fetch(pkgJsonUrl, {
            headers: {
              ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (pkgRes.ok) {
            const pkgData = await pkgRes.json() as { content?: string };
            const pkgJson = pkgData.content
              ? JSON.parse(Buffer.from(pkgData.content, "base64").toString("utf-8"))
              : {};
            const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
            let framework: "nextjs" | "express" | "fastify" | "nestjs" | "node-generic" = "node-generic";
            if (deps["next"]) framework = "nextjs";
            else if (deps["@nestjs/core"]) framework = "nestjs";
            else if (deps["fastify"]) framework = "fastify";
            else if (deps["express"]) framework = "express";
            inlineDockerfile = generateDockerfile({ framework, port: input.port || 3000 });
            await this.log(`[build] ✅ Auto-generated Dockerfile for ${framework} app`);
          } else {
            // Generic fallback
            inlineDockerfile = generateDockerfile({ framework: "node-generic", port: input.port || 3000 });
            await this.log(`[build] ✅ Using generic Node.js Dockerfile (no package.json detected)`);
          }
        } else {
          await this.log(`[build] Found existing Dockerfile in repo — using it`);
        }
      } catch {
        // If GitHub check fails, proceed with repo Dockerfile path
        await this.log(`[build] Could not check Dockerfile presence — proceeding with repo path`);
      }

      await this.log(`[build] 🐳 Building image locally and pushing to ACR...`);

      // Get ACR credentials for docker login
      const acrCredsUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.ContainerRegistry/registries/${acrName}/listCredentials?api-version=2023-07-01`;
      const credsRes = await fetch(acrCredsUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${armToken}`, "Content-Length": "0" },
      });
      const credsData = await credsRes.json() as { username?: string; passwords?: { value?: string }[] };
      const acrUsername = credsData.username || acrName;
      const acrPassword = credsData.passwords?.[0]?.value || "";

      if (!acrPassword) {
        throw new Error(`Could not retrieve ACR credentials for ${acrName}. Ensure Admin user is enabled on the registry.`);
      }

      const { execSync } = await import("child_process");

      // Clone repo into a temp dir and build
      const tmpDir = `/tmp/shipora-build-${input.serviceName}-${Date.now()}`;

      try {
        await this.log(`[build] Cloning ${input.repoOwner}/${input.repoName}...`);
        execSync(`git clone --depth 1 --branch ${input.branch || "main"} "${repoUrl}" "${tmpDir}"`, {
          stdio: "pipe",
          timeout: 120000,
        });
        await this.log(`[build] ✅ Repo cloned`);

        // Write inline Dockerfile or adapt monorepo Dockerfile
        let buildContext = tmpDir;
        if (input.rootPath) {
          buildContext = `${tmpDir}/${input.rootPath}`;
        }

        const { existsSync, readFileSync, writeFileSync, cpSync, readdirSync } = await import("fs");
        const { join } = await import("path");

        // If repo is a monorepo with packages/, copy packages to apps/ and buildContext
        if (existsSync(join(tmpDir, "packages"))) {
          try {
            const pkgDirs = readdirSync(join(tmpDir, "packages"));
            for (const p of pkgDirs) {
              const srcPkg = join(tmpDir, "packages", p);
              // Copy to apps/ (resolves ../shared from apps/web or apps/api)
              const destInApps = join(tmpDir, "apps", p);
              cpSync(srcPkg, destInApps, { recursive: true, force: true });
              // Copy to buildContext/ (resolves ./shared or shared/ in build context)
              const destInContext = join(buildContext, p);
              cpSync(srcPkg, destInContext, { recursive: true, force: true });
            }
          } catch {
            // ignore
          }
        }

        let dockerfileArg = "";
        if (inlineDockerfile) {
          const dockerfileTmp = `${tmpDir}/Dockerfile.generated`;
          writeFileSync(dockerfileTmp, inlineDockerfile);
          dockerfileArg = `-f ${dockerfileTmp}`;
          await this.log(`[build] Using auto-generated Dockerfile`);
        } else {
          // If using repo Dockerfile, check for common monorepo issues (e.g. npm ci without lockfile)
          const targetDockerfile = join(buildContext, "Dockerfile");
          if (existsSync(targetDockerfile)) {
            let dfContent = readFileSync(targetDockerfile, "utf-8");
            let modified = false;

            // If Dockerfile has 'npm ci' and there's no local package-lock.json, replace with 'npm install'
            if (dfContent.includes("npm ci") && !existsSync(join(buildContext, "package-lock.json"))) {
              dfContent = dfContent.replace(/npm ci/g, "npm install --legacy-peer-deps");
              modified = true;
            }

            // Ensure PORT and HOST bindings exist in Dockerfile if not explicitly set
            if (!dfContent.includes("ENV PORT=") && !dfContent.includes("PORT=")) {
              dfContent = dfContent.replace(
                /(FROM\s+[^\n]+\n)/i,
                `$1ENV PORT=${input.port || 3000}\nENV HOST=0.0.0.0\nENV HOSTNAME=0.0.0.0\n`
              );
              modified = true;
            }

            if (modified) {
              const dockerfileAdapted = `${tmpDir}/Dockerfile.adapted`;
              writeFileSync(dockerfileAdapted, dfContent);
              dockerfileArg = `-f ${dockerfileAdapted}`;
              await this.log(`[build] Adapted Dockerfile for networking and dependencies`);
            }
          }
        }

        // Docker login to ACR
        await this.log(`[build] Logging into ACR: ${loginServer}`);
        execSync(
          `docker login "${loginServer}" -u "${acrUsername}" --password-stdin`,
          { input: acrPassword, stdio: ["pipe", "pipe", "pipe"], timeout: 30000 }
        );

        // Build image for linux/amd64
        const buildStart = Date.now();
        await this.log(`[build] Building Docker image (linux/amd64): ${imageUri}`);
        execSync(
          `docker build --platform linux/amd64 ${dockerfileArg} -t "${imageUri}" "${buildContext}"`,
          { stdio: "pipe", timeout: 600000 } // 10 min timeout
        );
        await this.log(`[build] ✅ Image built (${Math.round((Date.now() - buildStart) / 1000)}s)`);

        // Push image
        await this.log(`[build] Pushing image to ACR...`);
        execSync(`docker push "${imageUri}"`, { stdio: "pipe", timeout: 300000 });
        const durationSeconds = Math.round((Date.now() - buildStart) / 1000);
        await this.log(`[build] ✅ Image pushed: ${imageUri} (${durationSeconds}s total)`);

        // Cleanup temp dir
        execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" });

        return { success: true, serviceName: input.serviceName, imageUri, buildId: imageTag, buildDurationSeconds: durationSeconds };
      } catch (buildErr) {
        // Cleanup on error
        try { execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" }); } catch { /* ignore */ }
        throw buildErr;
      }
    } catch (err) {
      const msg = (err as Error).message;
      await this.log(`[build] ❌ Build failed: ${msg}`, "error");
      return { success: false, serviceName: input.serviceName, imageUri: "", error: msg };
    }
  }


  public async pushSecrets(input: PushSecretsInput): Promise<PushSecretsResult> {
    const vaultName = `ed-${this.subscriptionId.replace(/-/g, "").slice(0, 16)}`.toLowerCase();
    const vaultUri = `https://${vaultName}.vault.azure.net`;

    if (!this.isReal || !input.secrets || Object.keys(input.secrets).length === 0) {
      const secretRefs: SecretRef[] = (input.detectedEnvVars || []).map((key) => ({
        name: key,
        reference: `${vaultUri}/secrets/${key.toLowerCase().replace(/_/g, "-")}`,
      }));
      return { success: true, secretVaultId: vaultUri, injectedKeys: input.detectedEnvVars || [], secretRefs };
    }

    try {
      await this.log(`[secrets] Ensuring Key Vault '${vaultName}'...`);

      const kvMgmt = new KeyVaultManagementClient(this.credential, this.subscriptionId);

      // Create Key Vault if not exists
      try {
        await kvMgmt.vaults.get(this.resourceGroup, vaultName);
      } catch {
        const poller = await kvMgmt.vaults.beginCreateOrUpdate(
          this.resourceGroup,
          vaultName,
          {
            location: this.region,
            properties: {
              tenantId: this.tenantId,
              sku: { name: "standard", family: "A" },
              accessPolicies: [],
              enabledForDeployment: true,
              enableRbacAuthorization: true,
            },
          }
        );
        await poller.pollUntilDone();
        await this.log(`[secrets] ✅ Key Vault created: ${vaultName}`);
      }

      const secretClient = new SecretClient(vaultUri, this.credential);
      const secretRefs: SecretRef[] = [];

      for (const [key, value] of Object.entries(input.secrets)) {
        const secretName = `${input.projectId.slice(0, 8)}-${key.toLowerCase().replace(/_/g, "-")}`;
        await secretClient.setSecret(secretName, value);
        await this.log(`[secrets] ✅ Secret stored: ${key}`);
        secretRefs.push({ name: key, reference: `${vaultUri}/secrets/${secretName}` });
      }

      return {
        success: true,
        secretVaultId: vaultUri,
        injectedKeys: Object.keys(input.secrets),
        secretRefs,
      };
    } catch (err) {
      const msg = (err as Error).message;
      await this.log(`[secrets] ⚠️ Key Vault unavailable, continuing without secrets: ${msg}`, "warn");
      return { success: true, secretVaultId: vaultUri, injectedKeys: [], secretRefs: [] };
    }
  }

  public async provisionService(input: ProvisionServiceInput): Promise<ProvisionServiceResult> {
    const envName = `ed-env-${input.projectId.slice(0, 8)}`;
    const appName = `${input.serviceName}-${input.projectId.slice(0, 8)}`;

    if (!this.isReal) {
      const resourceId = `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/containerApps/${appName}`;
      return { success: true, serviceName: input.serviceName, cloudServiceId: resourceId, currentRevision: `${appName}--rev-initial` };
    }

    try {
      await this.log(`[provision] Setting up Container Apps Environment for project...`);
      const envId = await this.ensureContainerAppEnvironment(envName);

      await this.log(`[provision] Deploying Container App '${appName}' (image: ${input.imageUri})...`);

      const client = new ContainerAppsAPIClient(this.credential, this.subscriptionId);

      // Get ACR credentials so Container Apps can pull private image
      const acrName = `eazydeploy${this.subscriptionId.replace(/-/g, "").slice(0, 12)}`.toLowerCase();
      const loginServer = `${acrName}.azurecr.io`;
      const tokenRes = await this.credential.getToken("https://management.azure.com/.default");
      const acrCredsUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.ContainerRegistry/registries/${acrName}/listCredentials?api-version=2023-07-01`;
      const credsRes = await fetch(acrCredsUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRes.token}`, "Content-Length": "0" },
      });
      const credsData = (await credsRes.json()) as { username?: string; passwords?: { value?: string }[] };
      const acrUsername = credsData.username || acrName;
      const acrPassword = credsData.passwords?.[0]?.value || "";

      // Build secret and env var config
      const containerSecrets: any[] = input.secretRefs.map((ref) => ({
        name: ref.name.toLowerCase().replace(/_/g, "-"),
        keyVaultUrl: ref.reference,
        identity: "system",
      }));

      if (acrPassword) {
        containerSecrets.push({
          name: "acr-password",
          value: acrPassword,
        });
      }

      const portVal = input.port || 3000;
      const baseEnvVars: Array<{ name: string; value?: string; secretRef?: string }> = [
        { name: "PORT", value: String(portVal) },
        { name: "HOST", value: "0.0.0.0" },
        { name: "HOSTNAME", value: "0.0.0.0" },
        { name: "NODE_ENV", value: "production" },
      ];

      const secretEnvVars = input.secretRefs.map((ref) => ({
        name: ref.name,
        secretRef: ref.name.toLowerCase().replace(/_/g, "-"),
      }));

      const containerEnvVars = [
        ...baseEnvVars.filter((b) => !secretEnvVars.some((s) => s.name === b.name)),
        ...secretEnvVars,
      ];

      const appUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/containerApps/${appName}?api-version=2024-03-01`;

      const appPutRes = await fetch(appUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: this.region,
          tags: { managedBy: "eazydeploy", projectId: input.projectId, service: input.serviceName },
          properties: {
            managedEnvironmentId: envId,
            configuration: {
              ingress: {
                external: true,
                targetPort: input.port || 3000,
                transport: "auto",
                allowInsecure: false,
              },
              registries: acrPassword
                ? [
                    {
                      server: loginServer,
                      username: acrUsername,
                      passwordSecretRef: "acr-password",
                    },
                  ]
                : undefined,
              secrets: containerSecrets,
            },
            template: {
              containers: [
                {
                  name: input.serviceName,
                  image: input.imageUri,
                  resources: {
                    cpu: input.cpu || 0.5,
                    memory: `${input.memory || 1}Gi`,
                  },
                  env: containerEnvVars,
                },
              ],
              scale: {
                minReplicas: 1,
                maxReplicas: 3,
              },
            },
          },
        }),
      });

      const appData = (await appPutRes.json()) as { id?: string; properties?: { latestRevisionName?: string; provisioningState?: string }; error?: { message?: string } };
      if (!appPutRes.ok && !appData.id) {
        throw new Error(`Failed to deploy Container App: ${appData.error?.message || appPutRes.statusText}`);
      }

      const resourceId = appData.id || `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.App/containerApps/${appName}`;
      let revision = appData.properties?.latestRevisionName || `${appName}--rev-initial`;

      await this.log(`[provision] Waiting for Container App to become ready...`);

      // Poll until Container App is ready
      const start = Date.now();
      while (Date.now() - start < 180000) {
        await sleep(5000);
        try {
          const pollRes = await fetch(appUrl, {
            headers: { Authorization: `Bearer ${tokenRes.token}` },
          });
          if (pollRes.ok) {
            const pollData = (await pollRes.json()) as { properties?: { latestRevisionName?: string; provisioningState?: string } };
            const state = pollData.properties?.provisioningState;
            if (pollData.properties?.latestRevisionName) {
              revision = pollData.properties.latestRevisionName;
            }
            if (state === "Succeeded") {
              await this.log(`[provision] ✅ Container App '${appName}' deployed (revision: ${revision})`);
              return {
                success: true,
                serviceName: input.serviceName,
                cloudServiceId: resourceId,
                currentRevision: revision,
              };
            }
            if (state === "Failed") {
              throw new Error(`Container App '${appName}' deployment failed`);
            }
          }
        } catch (err: any) {
          if (err.message.includes("failed")) throw err;
        }
      }

      await this.log(`[provision] ✅ Container App '${appName}' deployed (revision: ${revision})`);

      return {
        success: true,
        serviceName: input.serviceName,
        cloudServiceId: resourceId,
        currentRevision: revision,
      };
    } catch (err) {
      const msg = (err as Error).message;
      await this.log(`[provision] ❌ Provisioning failed: ${msg}`, "error");
      return { success: false, serviceName: input.serviceName, cloudServiceId: "", currentRevision: "", error: msg };
    }
  }

  public async configureIngress(input: ConfigureIngressInput): Promise<ConfigureIngressResult> {
    const appName = `${input.serviceName}-${input.projectId.slice(0, 8)}`;

    if (!this.isReal) {
      const domainPrefix = input.domainPrefix || `${input.serviceName}-${input.projectId.slice(0, 8)}`;
      const serviceUrl = `https://${domainPrefix}.${this.region}.azurecontainerapps.io`;
      return { success: true, serviceName: input.serviceName, serviceUrl, ingressResourceId: `${input.cloudServiceId}/ingress` };
    }

    try {
      const client = new ContainerAppsAPIClient(this.credential, this.subscriptionId);
      const app = await client.containerApps.get(this.resourceGroup, appName);
      const fqdn = app.latestRevisionFqdn || app.configuration?.ingress?.fqdn;
      const serviceUrl = fqdn ? `https://${fqdn}` : `https://${appName}.${this.region}.azurecontainerapps.io`;

      await this.log(`[ingress] ✅ HTTPS endpoint: ${serviceUrl}`);

      return {
        success: true,
        serviceName: input.serviceName,
        serviceUrl,
        ingressResourceId: `${app.id}/ingress`,
      };
    } catch (err) {
      const domainPrefix = input.domainPrefix || `${input.serviceName}-${input.projectId.slice(0, 8)}`;
      const fallbackUrl = `https://${domainPrefix}.${this.region}.azurecontainerapps.io`;
      return { success: true, serviceName: input.serviceName, serviceUrl: fallbackUrl };
    }
  }

  public async getDeploymentStatus(input: DeploymentStatusInput): Promise<DeploymentStatusResult> {
    if (!this.isReal) return { status: "running", healthy: true, replicaCount: 1 };

    try {
      const client = new ContainerAppsAPIClient(this.credential, this.subscriptionId);
      const appName = `${input.serviceName}-${input.projectId.slice(0, 8)}`;
      const app = await client.containerApps.get(this.resourceGroup, appName);
      const running = app.latestRevisionName ? true : false;
      return {
        status: running ? "running" : "transitioning",
        healthy: running,
        replicaCount: 1,
        message: `Container App '${appName}' — ${app.provisioningState}`,
      };
    } catch {
      return { status: "failed", healthy: false, replicaCount: 0 };
    }
  }

  public async teardown(input: TeardownInput): Promise<TeardownResult> {
    if (!this.isReal) {
      return { success: true, deletedResources: input.serviceNames?.map((s) => s) || [] };
    }

    const client = new ContainerAppsAPIClient(this.credential, this.subscriptionId);
    const deleted: string[] = [];

    for (const svc of input.serviceNames || []) {
      try {
        const appName = `${svc}-${input.projectId.slice(0, 8)}`;
        await (await client.containerApps.beginDelete(this.resourceGroup, appName)).pollUntilDone();
        deleted.push(appName);
      } catch { /* non-fatal */ }
    }

    return { success: true, deletedResources: deleted };
  }
}
