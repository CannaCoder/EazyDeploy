import type { ServiceType } from "@shipora/types";
import type { ConflictGuardActivityInput } from "./types.js";

export interface BuildContainerInput {
  projectId: string;
  serviceName: string;
  rootPath: string;
  commitSha: string;
  branch: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  ecrRepoUri?: string;
  buildCommand?: string;
}

export interface BuildContainerResult {
  success: boolean;
  serviceName: string;
  imageUri: string;
  buildId?: string;
  buildDurationSeconds?: number;
  error?: string;
}

export interface SyncSecretsInput {
  projectId: string;
  serviceName: string;
  detectedEnvVars: string[];
}

export interface TaskSecretRef {
  name: string;
  valueFrom: string;
}

export interface SyncSecretsResult {
  success: boolean;
  secretArn?: string;
  injectedKeys: string[];
  taskEnvSecretRefs: TaskSecretRef[];
  error?: string;
}

export interface ProvisionECSInput {
  projectId: string;
  serviceName: string;
  serviceType: ServiceType;
  port: number;
  imageUri: string;
  taskEnvSecretRefs: TaskSecretRef[];
  cpu?: number;
  memory?: number;
}

export interface ProvisionECSResult {
  success: boolean;
  serviceName: string;
  taskDefinitionArn: string;
  ecsServiceArn: string;
  error?: string;
}

export interface AttachLoadBalancerInput {
  projectId: string;
  serviceName: string;
  port: number;
  ecsServiceArn: string;
  domainPrefix?: string;
}

export interface AttachLoadBalancerResult {
  success: boolean;
  serviceName: string;
  targetGroupArn: string;
  serviceUrl: string;
  ruleArn?: string;
  error?: string;
}

export interface DeployActivities {
  buildContainerActivity(input: BuildContainerInput): Promise<BuildContainerResult>;
  syncSecretsActivity(input: SyncSecretsInput): Promise<SyncSecretsResult>;
  provisionECSActivity(input: ProvisionECSInput): Promise<ProvisionECSResult>;
  attachLoadBalancerActivity(input: AttachLoadBalancerInput): Promise<AttachLoadBalancerResult>;
}
