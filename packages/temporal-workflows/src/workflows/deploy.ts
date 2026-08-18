import {
  proxyActivities,
  defineQuery,
  setHandler,
} from "@temporalio/workflow";
import type {
  ConflictGuardActivities,
} from "../activities/conflict-guard-activities.js";
import type {
  DeployActivities,
  BuildContainerResult,
  ProvisionECSResult,
  AttachLoadBalancerResult,
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
  dashboardUrl?: string;
}

export interface ServiceDeployStatus {
  name: string;
  type: string;
  port?: number;
  stage: "pending" | "building" | "provisioning" | "routing" | "success" | "failed";
  imageUri?: string;
  taskDefinitionArn?: string;
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
    | "completed"
    | "failed";
  percent: number;
  currentStep: string;
  services: ServiceDeployStatus[];
  deployedUrls: Record<string, string>;
  error?: string;
}

export interface DeployWorkflowResult {
  success: boolean;
  deploymentId: string;
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
  buildContainerActivity,
  syncSecretsActivity,
  provisionECSActivity,
  attachLoadBalancerActivity,
} = proxyActivities<DeployActivities>({
  startToCloseTimeout: "15 minutes",
  retry: {
    initialInterval: "3s",
    maximumInterval: "60s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function deployWorkflow(
  input: DeployWorkflowInput
): Promise<DeployWorkflowResult> {
  let progress: DeployProgress = {
    stage: "initializing",
    percent: 5,
    currentStep: "Initializing multi-service deploy pipeline",
    services: [],
    deployedUrls: {},
  };

  setHandler(getDeployProgressQuery, () => progress);

  const targetUrl =
    input.dashboardUrl ||
    `https://app.shipora.dev/dashboard/projects/${input.projectId}/deployments/${input.deploymentId}`;

  // 1. Initial Status check on GitHub
  try {
    await reportGitHubStatusActivity({
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      installationId: input.installationId,
      state: "pending",
      description: "Shipora is deploying services to AWS ECS Fargate...",
      targetUrl,
    });
  } catch {
    // Non-fatal
  }

  // 2. Stage 1: Analyze repository and detect services
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
      servicesDeployed: [],
      deployedUrls: {},
      summary: errorMsg,
      error: errorMsg,
    };
  }

  if (!manifest.services || manifest.services.length === 0) {
    // Fallback default service if none explicitly detected
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

  // 3. Stage 2: Parallel AWS CodeBuild Container Builds
  progress = {
    ...progress,
    stage: "building",
    percent: 30,
    currentStep: `Building Docker container images for ${manifest.services.length} service(s) in parallel via AWS CodeBuild`,
    services: progress.services.map((s) => ({ ...s, stage: "building" })),
  };

  const buildResults: BuildContainerResult[] = await Promise.all(
    manifest.services.map(async (service) => {
      try {
        const buildRes = await buildContainerActivity({
          projectId: input.projectId,
          serviceName: service.name,
          rootPath: service.rootPath,
          commitSha: input.commitSha,
          branch: input.branch,
          repoOwner: input.repoOwner,
          repoName: input.repoName,
          installationId: input.installationId,
          buildCommand: service.buildCommand,
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

  // 4. Stage 3 & 4: Secret Syncing & ECS Task Provisioning per Service
  progress = {
    ...progress,
    stage: "provisioning",
    percent: 60,
    currentStep: "Injecting secrets and registering ECS Fargate Task Definitions",
  };

  const provisionedServices: ProvisionECSResult[] = [];

  for (const service of manifest.services) {
    const buildRes = buildResults.find((b) => b.serviceName === service.name);
    const imageUri = buildRes?.imageUri || `shipora/${service.name}:latest`;

    // 4a. Sync secrets for this service
    const secretSyncRes = await syncSecretsActivity({
      projectId: input.projectId,
      serviceName: service.name,
      detectedEnvVars: service.envVars || manifest.detectedEnvVars || [],
    });

    // 4b. Register ECS Task Definition and update ECS Service
    const provisionRes = await provisionECSActivity({
      projectId: input.projectId,
      serviceName: service.name,
      serviceType: service.type,
      port: service.port || 3000,
      imageUri,
      taskEnvSecretRefs: secretSyncRes.taskEnvSecretRefs || [],
    });

    if (!provisionRes.success) {
      const errorMsg = `ECS Provisioning failed for service '${service.name}': ${provisionRes.error}`;
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
        servicesDeployed: provisionedServices.map((p) => p.serviceName),
        deployedUrls: {},
        summary: errorMsg,
        error: errorMsg,
      };
    }

    provisionedServices.push(provisionRes);
  }

  // 5. Stage 5: Application Load Balancer Routing Configuration
  progress = {
    ...progress,
    stage: "routing",
    percent: 85,
    currentStep: "Configuring ALB Target Groups and Subdomain routing rules",
  };

  const deployedUrls: Record<string, string> = {};
  const deployedServiceNames: string[] = [];

  for (const service of manifest.services) {
    const prov = provisionedServices.find((p) => p.serviceName === service.name);
    const albRes: AttachLoadBalancerResult = await attachLoadBalancerActivity({
      projectId: input.projectId,
      serviceName: service.name,
      port: service.port || 3000,
      ecsServiceArn: prov?.ecsServiceArn || `arn:aws:ecs:us-east-1:123456789012:service/shipora-cluster/${service.name}`,
      domainPrefix: `${service.name}-${input.repoName.toLowerCase()}`,
    });

    deployedUrls[service.name] = albRes.serviceUrl;
    deployedServiceNames.push(service.name);
  }

  const successSummary = `Successfully deployed ${deployedServiceNames.length} service(s) to AWS ECS Fargate (${deployedServiceNames.join(", ")})`;

  // 6. Complete and Report GitHub Status
  progress = {
    stage: "completed",
    percent: 100,
    currentStep: "Deployment completed successfully",
    deployedUrls,
    services: progress.services.map((s) => ({
      ...s,
      stage: "success",
      serviceUrl: deployedUrls[s.name],
    })),
  };

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
    servicesDeployed: deployedServiceNames,
    deployedUrls,
    summary: successSummary,
    manifest,
  };
}
