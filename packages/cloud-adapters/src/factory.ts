import type { CloudProvider, CloudConnection } from "@shipora/types";
import type { CloudProviderAdapter } from "./adapter.js";
import { AwsAdapter } from "./aws/index.js";
import { AzureAdapter } from "./azure/index.js";

/**
 * Creates the appropriate CloudProviderAdapter instance based on provider enum.
 */
export function createCloudAdapter(
  provider: CloudProvider = "aws",
  connection?: Partial<CloudConnection>
): CloudProviderAdapter {
  switch (provider) {
    case "aws":
      return new AwsAdapter(connection);
    case "azure":
      return new AzureAdapter(connection);
    case "digitalocean":
    case "gcp":
      throw new Error(`Provider '${provider}' is scheduled for Phase 6 support.`);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported cloud provider: ${_exhaustive}`);
    }
  }
}
