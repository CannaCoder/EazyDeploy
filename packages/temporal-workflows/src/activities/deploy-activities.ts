import type { CloudProvider, ServiceType } from "@shipora/types";

export interface ResolveCloudAdapterInput {
  projectId: string;
}

export interface ResolveCloudAdapterResult {
  provider: CloudProvider;
  connectionId?: string;
}

export interface BuildImageActivityInput {
  projectId: string;
  deploymentId?: string; // required for log streaming; optional for legacy compat
  serviceName: string;
  rootPath: string;
  commitSha: string;
  branch: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  buildCommand?: string;
  registryUri?: string;
  ecrRepoUri?: string; // backward compat alias
  cloudProvider?: CloudProvider;
  connectionId?: string;
}

export interface BuildImageActivityResult {
  success: boolean;
  serviceName: string;
  imageUri: string;
  buildId?: string;
  buildDurationSeconds?: number;
  error?: string;
}

export interface SecretRef {
  name: string;
  reference?: string;
  valueFrom?: string; // backward compat alias
  value?: string;
}

export interface PushSecretsActivityInput {
  projectId: string;
  deploymentId?: string;
  serviceName: string;
  detectedEnvVars: string[];
  secrets?: Record<string, string>; // actual secret values for real Key Vault storage
  cloudProvider?: CloudProvider;
  connectionId?: string;
}

export interface PushSecretsActivityResult {
  success: boolean;
  secretVaultId?: string;
  secretArn?: string; // backward compat alias
  injectedKeys: string[];
  secretRefs: SecretRef[];
  taskEnvSecretRefs?: SecretRef[]; // backward compat alias
  error?: string;
}

export interface ProvisionServiceActivityInput {
  projectId: string;
  deploymentId?: string;
  serviceName: string;
  serviceType: ServiceType;
  port: number;
  imageUri: string;
  secretRefs?: SecretRef[];
  taskEnvSecretRefs?: SecretRef[]; // backward compat alias
  cpu?: number;
  memory?: number;
  cloudProvider?: CloudProvider;
  connectionId?: string;
}

export interface ProvisionServiceActivityResult {
  success: boolean;
  serviceName: string;
  cloudServiceId?: string;
  currentRevision?: string;
  taskDefinitionArn?: string; // backward compat alias
  ecsServiceArn?: string; // backward compat alias
  // Phase 4 — captured before update so rollback knows what to revert to
  previousTaskDefinitionArn?: string;
  previousRevisionName?: string; // Azure Container Apps
  error?: string;
}


export interface ConfigureIngressActivityInput {
  projectId: string;
  deploymentId?: string;
  serviceName: string;
  port: number;
  cloudServiceId?: string;
  ecsServiceArn?: string; // backward compat alias
  domainPrefix?: string;
  cloudProvider?: CloudProvider;
  connectionId?: string;
}

export interface ConfigureIngressActivityResult {
  success: boolean;
  serviceName: string;
  serviceUrl: string;
  ingressResourceId?: string;
  targetGroupArn?: string; // backward compat alias
  ruleArn?: string;
  error?: string;
}

// ─── Phase 4: Observability & Rollback Activity Interfaces ───────────────────

export interface StreamLogActivityInput {
  deploymentId: string;
  serviceName: string;
  logLine: string;
  level: "info" | "warn" | "error";
}

export interface StreamLogActivityResult {
  published: boolean;
}

export interface VerifyServiceTarget {
  serviceName: string;
  serviceType?: string;
  /** ALB DNS / Azure Container App HTTPS URL / CDN or Static Web URL */
  serviceUrl: string;
  cloudProvider: CloudProvider;
  /** ECS service ARN or Azure Container App name */
  cloudServiceId?: string;
  connectionId?: string;
}

export interface VerifyDeploymentActivityInput {
  deploymentId: string;
  services: VerifyServiceTarget[];
  /** Seconds to wait before first poll — default 40 (ALB target registration delay) */
  gracePeriodSeconds?: number;
  /** Seconds between polls — default 10 */
  pollIntervalSeconds?: number;
  /** Total timeout in seconds — default 300 (5 min) */
  timeoutSeconds?: number;
}

export interface VerifyDeploymentActivityResult {
  success: boolean;
  failedService?: string;
  reason?: string;
  latencyMs?: number;
}

export interface DeployStaticSiteActivityInput {
  projectId: string;
  deploymentId: string;
  serviceName: string;
  rootPath: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  installationId: number;
  cloudProvider?: CloudProvider;
  connectionId?: string;
}

export interface DeployStaticSiteActivityResult {
  success: boolean;
  serviceName: string;
  bucketName: string;
  distributionId?: string;
  serviceUrl: string;
  releasePrefix: string;
  error?: string;
}

export interface RollbackServiceRef {
  serviceName: string;
  cloudProvider: CloudProvider;
  connectionId?: string;
  serviceType?: ServiceType;
  // AWS Static
  bucketName?: string;
  distributionId?: string;
  previousReleasePrefix?: string;
  // AWS ECS
  ecsServiceArn?: string;
  previousTaskDefinitionArn?: string;
  // Azure
  containerAppName?: string;
  resourceGroup?: string;
  previousRevisionName?: string;
}

export interface RollbackActivityInput {
  deploymentId: string;
  projectId: string;
  reason: string;
  services: RollbackServiceRef[];
}

export interface RollbackActivityResult {
  success: boolean;
  rolledBackServices: string[];
  durationMs: number;
  error?: string;
}

export interface FinalizeDeploymentActivityInput {
  deploymentId: string;
  projectId: string;
  status: "success" | "failed";
  deployedUrls?: Record<string, string>;
  previousRevisionRefs?: Record<string, unknown>;
  summary?: string;
}

export interface FinalizeDeploymentActivityResult {
  success: boolean;
  error?: string;
}

// Backward-compatible type aliases
export type BuildContainerInput = BuildImageActivityInput;
export type BuildContainerResult = BuildImageActivityResult;
export type SyncSecretsInput = PushSecretsActivityInput;
export type SyncSecretsResult = PushSecretsActivityResult;
export type TaskSecretRef = SecretRef;
export type ProvisionECSInput = ProvisionServiceActivityInput;
export type ProvisionECSResult = ProvisionServiceActivityResult;
export type AttachLoadBalancerInput = ConfigureIngressActivityInput;
export type AttachLoadBalancerResult = ConfigureIngressActivityResult;

export interface DeployActivities {
  resolveCloudAdapterActivity(input: ResolveCloudAdapterInput): Promise<ResolveCloudAdapterResult>;
  buildImageActivity(input: BuildImageActivityInput): Promise<BuildImageActivityResult>;
  pushSecretsActivity(input: PushSecretsActivityInput): Promise<PushSecretsActivityResult>;
  provisionServiceActivity(input: ProvisionServiceActivityInput): Promise<ProvisionServiceActivityResult>;
  configureIngressActivity(input: ConfigureIngressActivityInput): Promise<ConfigureIngressActivityResult>;
  deployStaticSiteActivity(input: DeployStaticSiteActivityInput): Promise<DeployStaticSiteActivityResult>;
  // Phase 4
  streamLogActivity(input: StreamLogActivityInput): Promise<StreamLogActivityResult>;
  verifyDeploymentActivity(input: VerifyDeploymentActivityInput): Promise<VerifyDeploymentActivityResult>;
  rollbackActivity(input: RollbackActivityInput): Promise<RollbackActivityResult>;
  finalizeDeploymentActivity(input: FinalizeDeploymentActivityInput): Promise<FinalizeDeploymentActivityResult>;

  // Legacy aliases
  buildContainerActivity(input: BuildContainerInput): Promise<BuildContainerResult>;
  syncSecretsActivity(input: SyncSecretsInput): Promise<SyncSecretsResult>;
  provisionECSActivity(input: ProvisionECSInput): Promise<ProvisionECSResult>;
  attachLoadBalancerActivity(input: AttachLoadBalancerInput): Promise<AttachLoadBalancerResult>;
}

