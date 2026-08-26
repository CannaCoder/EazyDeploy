import type { CloudProvider, CloudConnection } from "@shipora/types";
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
} from "./types.js";

/**
 * CloudProviderAdapter — Common interface that every cloud provider implementation
 * (AWS, Azure, DigitalOcean, GCP) must fulfill to power Shipora deployments.
 */
export interface CloudProviderAdapter {
  readonly provider: CloudProvider;

  /**
   * Authenticate with the target cloud using stored credentials or role.
   */
  authenticate(connection?: Partial<CloudConnection>): Promise<AuthResult>;

  /**
   * Build container images from repository source code.
   */
  buildImage(input: BuildImageInput): Promise<BuildImageResult>;

  /**
   * Push and sync environment variables into the target cloud's native vault.
   */
  pushSecrets(input: PushSecretsInput): Promise<PushSecretsResult>;

  /**
   * Provision container compute workload (ECS Fargate, Azure Container Apps, etc.).
   */
  provisionService(input: ProvisionServiceInput): Promise<ProvisionServiceResult>;

  /**
   * Configure ingress, HTTPS certificates, and load balancing.
   */
  configureIngress(input: ConfigureIngressInput): Promise<ConfigureIngressResult>;

  /**
   * Read deployment running status and replica health.
   */
  getDeploymentStatus(input: DeploymentStatusInput): Promise<DeploymentStatusResult>;

  /**
   * Tear down and delete all Shipora-tagged resources on project deletion.
   */
  teardown(input: TeardownInput): Promise<TeardownResult>;

  /**
   * Deploy static site assets directly to Object Storage (S3 / Blob) + CDN (CloudFront / Front Door).
   */
  deployStaticSite?(input: import("./types.js").DeployStaticSiteInput): Promise<import("./types.js").DeployStaticSiteResult>;

  /**
   * Roll back static site CDN distribution to point to previous release prefix.
   */
  rollbackStaticSite?(input: import("./types.js").RollbackStaticSiteInput): Promise<import("./types.js").RollbackStaticSiteResult>;
}
