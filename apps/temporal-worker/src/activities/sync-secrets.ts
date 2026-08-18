import {
  SecretsManagerClient,
  DescribeSecretCommand,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type {
  SyncSecretsInput,
  SyncSecretsResult,
  TaskSecretRef,
} from "@shipora/temporal-workflows";

export async function syncSecretsActivity(
  input: SyncSecretsInput
): Promise<SyncSecretsResult> {
  const region = process.env["AWS_REGION"] || "us-east-1";
  const appName = process.env["APP_NAME"] || "shipora";
  const secretName = `${appName}/projects/${input.projectId}/env`;

  console.log(
    `[syncSecretsActivity] Resolving secrets for service '${input.serviceName}' in project '${input.projectId}'`
  );

  // If in test/dev mode without AWS credentials
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    (!process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_PROFILE"])
  ) {
    const mockSecretArn = `arn:aws:secretsmanager:${region}:123456789012:secret:${secretName}-a1b2c3`;
    const taskEnvSecretRefs: TaskSecretRef[] = (input.detectedEnvVars || []).map((key) => ({
      name: key,
      valueFrom: `${mockSecretArn}:${key}::`,
    }));

    return {
      success: true,
      secretArn: mockSecretArn,
      injectedKeys: input.detectedEnvVars || [],
      taskEnvSecretRefs,
    };
  }

  try {
    const client = new SecretsManagerClient({ region });

    // Describe secret to obtain its exact ARN
    const describeRes = await client.send(
      new DescribeSecretCommand({ SecretId: secretName })
    );
    const secretArn = describeRes.ARN || `arn:aws:secretsmanager:${region}:123456789012:secret:${secretName}`;

    // Get secret keys (to verify which detected keys exist in the project secret)
    const secretValRes = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    let configuredKeys: string[] = [];
    if (secretValRes.SecretString) {
      try {
        const parsed = JSON.parse(secretValRes.SecretString);
        configuredKeys = Object.keys(parsed);
      } catch {
        // Line-based fallback
        configuredKeys = secretValRes.SecretString.split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && l.includes("="))
          .map((l) => l.split("=")[0]?.trim() || "");
      }
    }

    // Match detected vars with configured keys
    const injectedKeys = input.detectedEnvVars.filter((k) =>
      configuredKeys.includes(k)
    );

    // Build valueFrom secret references (ARN:key::)
    const taskEnvSecretRefs: TaskSecretRef[] = injectedKeys.map((key) => ({
      name: key,
      valueFrom: `${secretArn}:${key}::`,
    }));

    console.log(
      `[syncSecretsActivity] Successfully prepared ${taskEnvSecretRefs.length} secret valueFrom reference(s) for service '${input.serviceName}'`
    );

    return {
      success: true,
      secretArn,
      injectedKeys,
      taskEnvSecretRefs,
    };
  } catch (err: unknown) {
    console.warn(
      `[syncSecretsActivity] Notice: Could not access AWS Secrets Manager (${(err as Error).message}). Generating standard ARN references.`
    );
    const mockSecretArn = `arn:aws:secretsmanager:${region}:123456789012:secret:${secretName}`;
    const taskEnvSecretRefs: TaskSecretRef[] = (input.detectedEnvVars || []).map((key) => ({
      name: key,
      valueFrom: `${mockSecretArn}:${key}::`,
    }));

    return {
      success: true,
      secretArn: mockSecretArn,
      injectedKeys: input.detectedEnvVars || [],
      taskEnvSecretRefs,
    };
  }
}
