import type { CloudProvider, CloudConnection } from "@shipora/types";
import type { CloudProviderAdapter } from "./adapter.js";
import { AwsAdapter } from "./aws/index.js";
import { AzureAdapter } from "./azure/index.js";
import { DigitalOceanAdapter } from "./digitalocean/index.js";
import { GcpAdapter } from "./gcp/index.js";

/**
 * Creates the appropriate CloudProviderAdapter instance based on provider enum.
 */
export function createCloudAdapter(
  provider: CloudProvider = "aws",
  connection?: Partial<CloudConnection> & {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    clientSecret?: string;
    apiToken?: string;
    token?: string;
    serviceAccountKey?: string;
    projectId?: string;
  }
): CloudProviderAdapter {
  switch (provider) {
    case "aws":
      return new AwsAdapter(connection);
    case "azure":
      return new AzureAdapter(connection);
    case "digitalocean":
      return new DigitalOceanAdapter(connection as any);
    case "gcp":
      return new GcpAdapter(connection as any);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported cloud provider: ${_exhaustive}`);
    }
  }
}
