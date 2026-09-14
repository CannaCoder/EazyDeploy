import {
  proxyActivities,
  defineQuery,
  setHandler,
} from "@temporalio/workflow";
import type { CloudProvider } from "@shipora/types";
import type {
  ConflictGuardActivities,
} from "../activities/conflict-guard-activities.js";
import type {
  DeployActivities,
  BuildImageActivityResult,
  ProvisionServiceActivityResult,
  ConfigureIngressActivityResult,
} from "../activities/deploy-activities.js";
import type { ServiceManifest } from "../activities/types.js";

export interface DeployWorkflowInput {
  deploymentId: string;
  projectId: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  installationId: number;
  cloudProvider?: CloudProvider;
  cloudConnectionId?: string;
  dashboardUrl?: string;
  envVars?: Record<string, string>;
  serviceSecrets?: Record<string, Record<string, string>>;
}

export interface ServiceDeployStatus {
  name: string;
  type: string;
  port?: number;
  stage: "pending" | "building" | "provisioning" | "routing" | "success" | "failed";
  imageUri?: string;
  cloudServiceId?: string;
  currentRevision?: string;
  serviceUrl?: string;
  error?: string;
}

export interface DeployProgress {
  stage:
    | "initializing"
    | "analyzing"
    | "building"
    | "syncing_secrets"
    | "provisioning"
    | "routing"
    | "verifying"
    | "rolling_back"
    | "completed"
    | "failed";
  percent: number;
  currentStep: string;
  provider: CloudProvider;
  services: ServiceDeployStatus[];
  deployedUrls: Record<string, string>;
  previousRevisionRefs?: Record<string, { aws?: string; azure?: string }>;
  error?: string;
}

export interface DeployWorkflowResult {
  success: boolean;
  deploymentId: string;
  provider: CloudProvider;
  servicesDeployed: string[];
  deployedUrls: Record<string, string>;
  summary: string;
  manifest?: ServiceManifest;
  error?: string;
}

export const getDeployProgressQuery = defineQuery<DeployProgress>("getDeployProgress");

const {
  analyzeRepoActivity,
  reportGitHubStatusActivity,
} = proxyActivities<ConflictGuardActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "2s",
    maximumInterval: "30s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const {
  resolveCloudAdapterActivity,
  buildImageActivity,
  pushSecretsActivity,
  provisionServiceActivity,
  configureIngressActivity,
  deployStaticSiteActivity,
} = proxyActivities<DeployActivities>({
  startToCloseTimeout: "15 minutes",
  retry: {
    initialInterval: "3s",
    maximumInterval: "60s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const {
  streamLogActivity,
  verifyDeploymentActivity,
  rollbackActivity,
  finalizeDeploymentActivity,
} = proxyActivities<DeployActivities>({
  startToCloseTimeout: "7 minutes",
  retry: {
    initialInterval: "2s",
    maximumInterval: "15s",
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
});

export async function deployWorkflow(
  input: DeployWorkflowInput
): Promise<DeployWorkflowResult> {
  let provider: CloudProvider = input.cloudProvider || "aws";
  let connectionId: string | undefined = input.cloudConnectionId;

  let progress: DeployProgress = {
    stage: "initializing",
    percent: 5,
    currentStep: "Initializing multi-cloud deploy pipeline",
    provider,
    services: [],
    deployedUrls: {},
  };

  setHandler(getDeployProgressQuery, () => progress);

  const targetUrl =
    input.dashboardUrl ||
    `https://app.shipora.dev/dashboard/projects/${input.projectId}/deployments/${input.deploymentId}`;

  // 1. Resolve Cloud Provider and Connection from DB if not explicitly passed
  try {
    if (!input.cloudProvider) {
      const resolved = await resolveCloudAdapterActivity({ projectId: input.projectId });
      if (resolved?.provider) {
        provider = resolved.provider;
        connectionId = resolved.connectionId || connectionId;
        progress.provider = provider;
      }
    }
  } catch {
    // Fall back to input or default 'aws'
  }

  const providerLabel = provider.toUpperCase();

  // 2. Initial Status check on GitHub
  try {
    await reportGitHubStatusActivity({
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      installationId: input.installationId,
      state: "pending",
      description: `Shipora is deploying services to ${providerLabel}...`,
      targetUrl,
    });
  } catch {
    // Non-fatal
  }

  // 3. Stage 1: Analyze repository and detect services
  progress = {
    ...progress,
    stage: "analyzing",
    percent: 15,
    currentStep: "Analyzing repository services, ports, and build configurations",
  };

  let manifest: ServiceManifest;
  try {
    manifest = await analyzeRepoActivity({
      projectId: input.projectId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      branch: input.branch,
      installationId: input.installationId,
    });
  } catch (err: unknown) {
    const errorMsg = `Repository analysis failed: ${(err as Error).message}`;
    progress = {
      ...progress,
      stage: "failed",
      percent: 100,
      currentStep: errorMsg,
      error: errorMsg,
    };
    return {
      success: false,
      deploymentId: input.deploymentId,
      provider,
      servicesDeployed: [],
      deployedUrls: {},
      summary: errorMsg,
      error: errorMsg,
    };
  }

  if (!manifest.services || manifest.services.length === 0) {
    manifest.services = [
      {
        name: "web",
        type: "nextjs",
        rootPath: ".",
        port: 3000,
        envVars: manifest.detectedEnvVars || [],
      },
    ];
  }

  progress = {
    ...progress,
    services: manifest.services.map((s) => ({
      name: s.name,
      type: s.type,
      port: s.port,
      stage: "pending",
    })),
  };

  // 4. Stage 2: Parallel Container Builds
  progress = {
    ...progress,
    stage: "building",
    percent: 30,
    currentStep: `Building and preparing ${manifest.services.length} service(s) via ${providerLabel}`,
    services: progress.services.map((s) => ({ ...s, stage: "building" })),
  };

  const buildResults: BuildImageActivityResult[] = await Promise.all(
    manifest.services.map(async (service) => {
      // Pure static sites bypass heavy container builds
      if (service.type === "static") {
        return {
          success: true,
          serviceName: service.name,
          imageUri: "s3-cloudfront-static",
        };
      }

      try {
        const buildRes = await buildImageActivity({
          projectId: input.projectId,
          deploymentId: input.deploymentId,
          serviceName: service.name,
          rootPath: service.rootPath,
          commitSha: input.commitSha,
          branch: input.branch,
          repoOwner: input.repoOwner,
          repoName: input.repoName,
          installationId: input.installationId,
          buildCommand: service.buildCommand,
          cloudProvider: provider,
          connectionId,
        });
        return buildRes;
      } catch (err: unknown) {
        return {
          success: false,
          serviceName: service.name,
          imageUri: "",
          error: (err as Error).message,
        };
      }
    })
  );

  // Check for any build failures
  const failedBuilds = buildResults.filter((b) => !b.success);
  if (failedBuilds.length > 0) {
    const errorMsg = `Container build failed for: ${failedBuilds.map((f) => f.serviceName).join(", ")}`;
    progress = {
      ...progress,
      stage: "failed",
      percent: 100,
      currentStep: errorMsg,
      error: errorMsg,
    };

    try {
      await reportGitHubStatusActivity({
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        commitSha: input.commitSha,
        installationId: input.installationId,
        state: "failure",
        description: `Shipora deploy failed: ${errorMsg}`.slice(0, 140),
        targetUrl,
      });
    } catch {
      // ignore
    }

    return {
      success: false,
      deploymentId: input.deploymentId,
      provider,
      servicesDeployed: [],
      deployedUrls: {},
      summary: errorMsg,
      error: errorMsg,
    };
  }

  // Update image URIs in progress
  progress = {
    ...progress,
    services: progress.services.map((s) => {
      const b = buildResults.find((res) => res.serviceName === s.name);
      return {
        ...s,
        stage: "provisioning",
        imageUri: b?.imageUri,
      };
    }),
  };

  // 5. Stage 3 & 4: Secret Syncing & Compute / Static Provisioning per Service
  progress = {
    ...progress,
    stage: "provisioning",
    percent: 60,
    currentStep: `Deploying services to ${providerLabel}`,
  };

  const provisionedServices: ProvisionServiceActivityResult[] = [];
  const deployedUrls: Record<string, string> = {};
  const deployedServiceNames: string[] = [];

  for (const service of manifest.services) {
    if (service.type === "static") {
      // Direct Static Deployment to S3 + CloudFront CDN
      const staticRes = await deployStaticSiteActivity({
        projectId: input.projectId,
        deploymentId: input.deploymentId,
        serviceName: service.name,
        rootPath: service.rootPath,
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        commitSha: input.commitSha,
        branch: input.branch,
        installationId: input.installationId,
        cloudProvider: provider,
        connectionId,
      });

      if (!staticRes.success) {
        const errorMsg = `Static site deployment failed for '${service.name}': ${staticRes.error}`;
        progress = {
          ...progress,
          stage: "failed",
          percent: 100,
          currentStep: errorMsg,
          error: errorMsg,
        };
        return {
          success: false,
          deploymentId: input.deploymentId,
          provider,
          servicesDeployed: provisionedServices.map((p) => p.serviceName),
          deployedUrls: {},
          summary: errorMsg,
          error: errorMsg,
        };
      }

      provisionedServices.push({
        success: true,
        serviceName: service.name,
        cloudServiceId: staticRes.distributionId || staticRes.bucketName,
        currentRevision: staticRes.releasePrefix,
      });
      deployedUrls[service.name] = staticRes.serviceUrl;
      deployedServiceNames.push(service.name);
      continue;
    }

    const buildRes = buildResults.find((b) => b.serviceName === service.name);
    const imageUri = buildRes?.imageUri || `shipora/${service.name}:latest`;

    // 5a. Push secrets for this service
    const serviceSecrets =
      input.serviceSecrets?.[service.name] ||
      input.envVars ||
      {};

    const secretPushRes = await pushSecretsActivity({
      projectId: input.projectId,
      deploymentId: input.deploymentId,
      serviceName: service.name,
      detectedEnvVars: service.envVars || manifest.detectedEnvVars || [],
      secrets: Object.keys(serviceSecrets).length > 0 ? serviceSecrets : undefined,
      cloudProvider: provider,
      connectionId,
    });

    const explicitPort = input.envVars?.["PORT"] ? parseInt(input.envVars["PORT"], 10) : undefined;
    const resolvedPort = explicitPort || service.port || (provider === "azure" ? 80 : 3000);

    // 5b. Provision compute workload
    const provisionRes = await provisionServiceActivity({
      projectId: input.projectId,
      deploymentId: input.deploymentId,
      serviceName: service.name,
      serviceType: service.type,
      port: resolvedPort,
      imageUri,
      secretRefs: secretPushRes.secretRefs || secretPushRes.taskEnvSecretRefs || [],
      cloudProvider: provider,
      connectionId,
    });

    if (!provisionRes.success) {
      const errorMsg = `Provisioning failed for service '${service.name}': ${provisionRes.error}`;
      progress = {
        ...progress,
        stage: "failed",
        percent: 100,
        currentStep: errorMsg,
        error: errorMsg,
      };
      return {
        success: false,
        deploymentId: input.deploymentId,
        provider,
        servicesDeployed: provisionedServices.map((p) => p.serviceName),
        deployedUrls: {},
        summary: errorMsg,
        error: errorMsg,
      };
    }

    provisionedServices.push(provisionRes);
  }

  // 6. Stage 5: Ingress and Routing Configuration for container services
  progress = {
    ...progress,
    stage: "routing",
    percent: 85,
    currentStep: `Configuring ${providerLabel} ingress routing and HTTPS endpoints`,
  };

  for (const service of manifest.services) {
    if (service.type === "static") continue; // Already configured during static deployment

    const prov = provisionedServices.find((p) => p.serviceName === service.name);
    const explicitPort = input.envVars?.["PORT"] ? parseInt(input.envVars["PORT"], 10) : undefined;
    const resolvedPort = explicitPort || service.port || (provider === "azure" ? 80 : 3000);

    const ingressRes: ConfigureIngressActivityResult = await configureIngressActivity({
      projectId: input.projectId,
      deploymentId: input.deploymentId,
      serviceName: service.name,
      port: resolvedPort,
      cloudServiceId: prov?.cloudServiceId || prov?.ecsServiceArn || "",
      domainPrefix: `${service.name}-${input.repoName.toLowerCase()}`,
      cloudProvider: provider,
      connectionId,
    });

    deployedUrls[service.name] = ingressRes.serviceUrl;
    deployedServiceNames.push(service.name);
  }

  const successSummary = `Successfully deployed ${deployedServiceNames.length} service(s) to ${providerLabel} (${deployedServiceNames.join(", ")})`;

  // Build previousRevisionRefs map for rollback
  const previousRevisionRefs: Record<string, { aws?: string; azure?: string }> = {};
  for (const prov of provisionedServices) {
    previousRevisionRefs[prov.serviceName] = {
      aws: prov.previousTaskDefinitionArn,
      azure: prov.previousRevisionName,
    };
  }

  progress = {
    ...progress,
    deployedUrls,
    previousRevisionRefs,
  };

  // ── Stage 6: Health Verification ──────────────────────────────────────────
  progress = {
    ...progress,
    stage: "verifying",
    percent: 92,
    currentStep: `Verifying health of ${deployedServiceNames.length} deployed service(s) via ${provider === "azure" ? "Azure Container App" : "ALB"} endpoints`,
  };

  const verifyTargets = manifest.services.map((s) => {
    const prov = provisionedServices.find((p) => p.serviceName === s.name);
    return {
      serviceName: s.name,
      serviceType: s.type,
      serviceUrl: deployedUrls[s.name] || "",
      cloudProvider: provider,
      cloudServiceId: prov?.ecsServiceArn || prov?.cloudServiceId,
      connectionId,
    };
  });

  const isStaticOnly =
    manifest.services.length > 0 &&
    manifest.services.every((s) => s.type === "static");

  let verifyResult;
  try {
    verifyResult = await verifyDeploymentActivity({
      deploymentId: input.deploymentId,
      services: verifyTargets,
      gracePeriodSeconds: isStaticOnly ? 5 : provider === "azure" ? 45 : 30,
      pollIntervalSeconds: isStaticOnly ? 5 : 10,
      timeoutSeconds: isStaticOnly ? 90 : 120,
    });
  } catch (err: unknown) {
    verifyResult = { success: false, reason: (err as Error).message };
  }

  if (!verifyResult.success) {
    // ── Stage 6b: Auto-Rollback ─────────────────────────────────────────────
    const rollbackReason = verifyResult.reason || "Health check failed";

    progress = {
      ...progress,
      stage: "rolling_back",
      percent: 95,
      currentStep: `Rolling back — ${rollbackReason}`,
      error: rollbackReason,
    };

    const rollbackServices = provisionedServices.map((prov) => {
      const svcDef = manifest.services.find((s) => s.name === prov.serviceName);
      return {
        serviceName: prov.serviceName,
        cloudProvider: provider,
        connectionId,
        serviceType: svcDef?.type,
        // Static hosting
        distributionId: svcDef?.type === "static" ? prov.cloudServiceId : undefined,
        previousReleasePrefix: svcDef?.type === "static" ? prov.previousRevisionName : undefined,
        // AWS ECS
        ecsServiceArn: prov.ecsServiceArn || prov.cloudServiceId,
        previousTaskDefinitionArn: prov.previousTaskDefinitionArn,
        // Azure
        containerAppName: undefined as string | undefined,
        resourceGroup: undefined as string | undefined,
        previousRevisionName: prov.previousRevisionName,
      };
    });

    try {
      await rollbackActivity({
        deploymentId: input.deploymentId,
        projectId: input.projectId,
        reason: rollbackReason,
        services: rollbackServices,
      });
    } catch {
      // rollback failure logged inside activity
    }

    const errorSummary = `Auto-rolled back — ${rollbackReason}`;
    progress = {
      ...progress,
      stage: "failed",
      percent: 100,
      currentStep: errorSummary,
    };

    try {
      await reportGitHubStatusActivity({
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        commitSha: input.commitSha,
        installationId: input.installationId,
        state: "failure",
        description: `Shipora auto-rolled back: ${rollbackReason}`.slice(0, 140),
        targetUrl,
      });
    } catch {
      // Non-fatal
    }

    return {
      success: false,
      deploymentId: input.deploymentId,
      provider,
      servicesDeployed: deployedServiceNames,
      deployedUrls,
      summary: errorSummary,
      error: errorSummary,
    };
  }

  // 7. Complete and Report GitHub Status
  progress = {
    ...progress,
    stage: "completed",
    percent: 100,
    currentStep: "Deployment verified and live",
    deployedUrls,
    services: progress.services.map((s) => ({
      ...s,
      stage: "success",
      serviceUrl: deployedUrls[s.name],
    })),
  };

  try {
    await finalizeDeploymentActivity({
      deploymentId: input.deploymentId,
      projectId: input.projectId,
      status: "success",
      deployedUrls,
      previousRevisionRefs,
      summary: successSummary,
    });
  } catch {
    // Non-fatal
  }

  try {
    await reportGitHubStatusActivity({
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      installationId: input.installationId,
      state: "success",
      description: successSummary.slice(0, 140),
      targetUrl,
    });
  } catch {
    // Non-fatal
  }

  return {
    success: true,
    deploymentId: input.deploymentId,
    provider,
    servicesDeployed: deployedServiceNames,
    deployedUrls,
    summary: successSummary,
    manifest,
  };
}
