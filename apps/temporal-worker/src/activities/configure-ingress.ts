import { createCloudAdapter } from "@shipora/cloud-adapters";
import { streamLogActivity } from "./stream-log.js";
import { getAdapterCredentials } from "./get-adapter-credentials.js";
import type {
  ConfigureIngressActivityInput,
  ConfigureIngressActivityResult,
} from "@shipora/temporal-workflows";

export async function configureIngressActivity(
  input: ConfigureIngressActivityInput
): Promise<ConfigureIngressActivityResult> {
  const provider = input.cloudProvider || "aws";
  const credentials = await getAdapterCredentials(input.connectionId, provider);
  const adapter = createCloudAdapter(provider, credentials as any);

  // Wire adapter log callback to SSE stream
  if (provider === "azure" && (adapter as any).onLog !== undefined) {
    (adapter as any).onLog = async (line: string, level = "info") => {
      await streamLogActivity({
        deploymentId: input.deploymentId ?? "",
        serviceName: input.serviceName,
        logLine: line,
        level: level as "info" | "warn" | "error",
      });
    };
  }

  console.log(
    `[configureIngressActivity] Configuring ingress for '${input.serviceName}' via ${provider.toUpperCase()} adapter`
  );

  const res = await adapter.configureIngress({
    projectId: input.projectId,
    serviceName: input.serviceName,
    port: input.port,
    cloudServiceId: input.cloudServiceId || input.ecsServiceArn || "",
    domainPrefix: input.domainPrefix,
  });

  return {
    ...res,
    targetGroupArn: res.ingressResourceId || "",
  };
}
