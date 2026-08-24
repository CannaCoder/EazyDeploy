import { createCloudAdapter } from "@shipora/cloud-adapters";
import { streamLogActivity } from "./stream-log.js";
import { getAdapterCredentials } from "./get-adapter-credentials.js";
import type {
  ProvisionServiceActivityInput,
  ProvisionServiceActivityResult,
} from "@shipora/temporal-workflows";

export async function provisionServiceActivity(
  input: ProvisionServiceActivityInput
): Promise<ProvisionServiceActivityResult> {
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
    `[provisionServiceActivity] Provisioning '${input.serviceName}' via ${provider.toUpperCase()} adapter`
  );

  const rawRefs = input.secretRefs || input.taskEnvSecretRefs || [];
  const mappedSecretRefs = rawRefs.map((ref) => ({
    name: ref.name,
    reference: ref.reference || (ref as any).valueFrom || "",
  }));

  const res = await adapter.provisionService({
    ...input,
    secretRefs: mappedSecretRefs,
  });

  return {
    ...res,
    taskDefinitionArn: res.currentRevision,
    ecsServiceArn: res.cloudServiceId,
  };
}
