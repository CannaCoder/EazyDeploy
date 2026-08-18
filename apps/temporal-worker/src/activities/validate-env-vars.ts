import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import type {
  ConflictGuardActivityInput,
  ValidateEnvVarsResult,
} from "@shipora/temporal-workflows";

const secretsClient = new SecretsManagerClient({
  region: process.env["AWS_REGION"] || "us-east-1",
});

/**
 * Activity: validateEnvVarsActivity
 * Validates that all environment variable keys discovered during static code analysis
 * exist in the project's encrypted AWS Secrets Manager secret (`shipora/projects/{projectId}/env`).
 *
 * CRITICAL SECURITY GUARANTEE:
 * Only keys (names) are inspected and returned. Secret values are NEVER extracted,
 * printed, logged, or recorded in Temporal workflow state history.
 */
export async function validateEnvVarsActivity(
  input: ConflictGuardActivityInput,
  detectedVars: string[]
): Promise<ValidateEnvVarsResult> {
  const secretId = `shipora/projects/${input.projectId}/env`;
  let existingKeys: string[] = [];

  try {
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await secretsClient.send(command);

    if (response.SecretString) {
      try {
        const parsed = JSON.parse(response.SecretString) as Record<string, unknown>;
        existingKeys = Object.keys(parsed);
      } catch {
        // Parse error or non-JSON secret (dotenv format key=val lines)
        const lines = response.SecretString.split(/\r?\n/);
        for (const line of lines) {
          const match = /^\s*([A-Z0-9_]+)\s*=/i.exec(line);
          if (match?.[1]) {
            existingKeys.push(match[1]);
          }
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof ResourceNotFoundException) {
      console.warn(`[validateEnvVarsActivity] Secret ${secretId} not yet created in AWS Secrets Manager.`);
    } else {
      console.warn(`[validateEnvVarsActivity] Could not access AWS Secrets Manager:`, (err as Error).message);
    }
  }

  // Filter missing keys
  const existingSet = new Set(existingKeys);
  const missing = detectedVars.filter((v) => !existingSet.has(v));

  // If running in development without secrets configured, pass with warning
  const isDevWithoutSecrets =
    process.env["NODE_ENV"] !== "production" &&
    existingKeys.length === 0 &&
    (process.env["AWS_ACCESS_KEY_ID"]?.startsWith("mock_") || !process.env["AWS_ACCESS_KEY_ID"]);

  const passed = isDevWithoutSecrets ? true : missing.length === 0;

  return {
    passed,
    missing: isDevWithoutSecrets ? [] : missing,
    detected: detectedVars,
    existingSecrets: existingKeys,
  };
}
