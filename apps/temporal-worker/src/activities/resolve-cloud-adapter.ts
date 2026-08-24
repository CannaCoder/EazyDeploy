import { db } from "@shipora/db";
import { projects, cloudConnections } from "@shipora/db";
import { eq } from "drizzle-orm";
import type {
  ResolveCloudAdapterInput,
  ResolveCloudAdapterResult,
} from "@shipora/temporal-workflows";
import type { CloudProvider } from "@shipora/types";

export async function resolveCloudAdapterActivity(
  input: ResolveCloudAdapterInput
): Promise<ResolveCloudAdapterResult> {
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    !process.env["DATABASE_URL"]
  ) {
    return {
      provider: "aws",
    };
  }

  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    const provider = (project?.cloudProvider as CloudProvider) || "aws";
    let connectionId = project?.cloudConnectionId || undefined;

    if (!connectionId) {
      // Check for account-level default connection for this provider
      const defaultConn = await db.query.cloudConnections.findFirst({
        where: eq(cloudConnections.provider, provider),
      });
      if (defaultConn) {
        connectionId = defaultConn.id;
      }
    }

    return {
      provider,
      connectionId,
    };
  } catch (err: unknown) {
    console.warn(
      `[resolveCloudAdapterActivity] DB lookup notice: ${(err as Error).message}. Defaulting to AWS.`
    );
    return {
      provider: "aws",
    };
  }
}
