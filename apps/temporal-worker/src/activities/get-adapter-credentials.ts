/**
 * Resolves the Azure/AWS credentials for a cloud connection by looking up
 * the DB record and decrypting stored secrets.
 *
 * Falls back to process.env platform credentials if no connectionId is given
 * (used for local dev / testing).
 */
import { db } from "@shipora/db";
import { cloudConnections } from "@shipora/db";
import { eq } from "drizzle-orm";
import { createCipheriv, createDecipheriv } from "crypto";

// Inline decrypt to avoid circular deps — mirrors apps/api/src/lib/crypto.ts
function decryptIfPresent(encryptedBase64: string | null | undefined): string | null {
  if (!encryptedBase64) return null;
  try {
    const hex = process.env["ENCRYPTION_KEY"];
    if (!hex || hex.length !== 64) return null;
    const key = Buffer.from(hex, "hex");
    const data = Buffer.from(encryptedBase64, "base64");
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
  } catch {
    return null;
  }
}

export interface AzureCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  resourceGroup: string;
}

/**
 * Returns credentials for the cloud adapter.
 * Priority: DB connection record (user's own SP) → process.env (platform fallback)
 */
export async function getAdapterCredentials(
  connectionId: string | undefined,
  provider: string
): Promise<Partial<AzureCredentials>> {
  // Env fallback — always available
  const envCredentials: Partial<AzureCredentials> = {
    tenantId: process.env["AZURE_TENANT_ID"],
    clientId: process.env["AZURE_CLIENT_ID"],
    clientSecret: process.env["AZURE_CLIENT_SECRET"],
    subscriptionId: process.env["AZURE_SUBSCRIPTION_ID"],
    resourceGroup: process.env["AZURE_RESOURCE_GROUP"] || "eazydeploy-rg",
  };

  if (!connectionId || provider !== "azure") {
    return envCredentials;
  }

  if (!process.env["DATABASE_URL"]) {
    return envCredentials;
  }

  try {
    const conn = await db.query.cloudConnections.findFirst({
      where: eq(cloudConnections.id, connectionId),
    });

    if (!conn) {
      console.warn(`[getAdapterCredentials] Connection ${connectionId} not found in DB, using env fallback`);
      return envCredentials;
    }

    const decryptedSecret = decryptIfPresent(conn.clientSecretRef);

    return {
      tenantId: conn.tenantId || envCredentials.tenantId,
      clientId: conn.clientId || envCredentials.clientId,
      clientSecret: decryptedSecret || envCredentials.clientSecret,
      subscriptionId: conn.subscriptionId || envCredentials.subscriptionId,
      resourceGroup: conn.resourceGroup || envCredentials.resourceGroup,
    };
  } catch (err) {
    console.warn(`[getAdapterCredentials] DB lookup failed: ${(err as Error).message}, using env fallback`);
    return envCredentials;
  }
}
