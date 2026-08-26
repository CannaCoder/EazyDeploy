import type { CloudProvider, CloudConnection, ServiceType } from "@shipora/types";

export interface AuthResult {
  success: boolean;
  identityArn?: string;
  tenantId?: string;
  error?: string;
}

export interface BuildImageInput {
  projectId: string;
  serviceName: string;
  rootPath: string;
  commitSha: string;
  branch: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  port?: number; // used for auto-generated Dockerfile
  buildCommand?: string;
  registryUri?: string;
}

export interface BuildImageResult {
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
  value?: string;
}

export interface PushSecretsInput {
  projectId: string;
  serviceName: string;
  detectedEnvVars: string[];
  secrets?: Record<string, string>;
}

export interface PushSecretsResult {
  success: boolean;
  secretVaultId?: string;
  injectedKeys: string[];
  secretRefs: SecretRef[];
  error?: string;
}

export interface ProvisionServiceInput {
  projectId: string;
  serviceName: string;
  serviceType: ServiceType;
  port: number;
  imageUri: string;
  secretRefs: SecretRef[];
  cpu?: number;
  memory?: number;
}

export interface ProvisionServiceResult {
  success: boolean;
  serviceName: string;
  cloudServiceId: string;
  currentRevision: string;
  error?: string;
}

export interface ConfigureIngressInput {
  projectId: string;
  serviceName: string;
  port: number;
  cloudServiceId: string;
  domainPrefix?: string;
}

export interface ConfigureIngressResult {
  success: boolean;
  serviceName: string;
  serviceUrl: string;
  ingressResourceId?: string;
  error?: string;
}

export interface DeploymentStatusInput {
  projectId: string;
  serviceName: string;
  cloudServiceId: string;
}

export interface DeploymentStatusResult {
  status: "running" | "stopped" | "failed" | "transitioning";
  healthy: boolean;
  replicaCount: number;
  message?: string;
}

export interface TeardownInput {
  projectId: string;
  serviceNames?: string[];
}

export interface TeardownResult {
  success: boolean;
  deletedResources: string[];
  error?: string;
}

export interface StaticFileAsset {
  path: string;
  content: string | Buffer;
  contentType?: string;
}

export interface DeployStaticSiteInput {
  projectId: string;
  serviceName: string;
  deploymentId: string;
  files?: StaticFileAsset[];
  customDomain?: string;
}

export interface DeployStaticSiteResult {
  success: boolean;
  serviceName: string;
  bucketName: string;
  distributionId?: string;
  serviceUrl: string;
  releasePrefix: string;
  error?: string;
}

export interface RollbackStaticSiteInput {
  projectId: string;
  serviceName: string;
  bucketName: string;
  distributionId: string;
  previousReleasePrefix: string;
}

export interface RollbackStaticSiteResult {
  success: boolean;
  serviceName: string;
  serviceUrl: string;
  error?: string;
}
