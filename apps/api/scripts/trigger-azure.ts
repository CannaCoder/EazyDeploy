import dotenv from "dotenv";
dotenv.config({ path: "/Users/binova/Documents/Projects/Suru/EazyDeploy/.env" });
import fs from "fs";
import { randomUUID } from "crypto";
import { db, deployments, projects } from "@shipora/db";
import { eq } from "drizzle-orm";
import { startDeployWorkflow } from "../src/plugins/temporal.js";

async function main() {
  const projectId = "96038281-f312-4932-b961-311ae0b2762f";
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Read Owed .env for complete runtime env vars
  const owedEnvContent = fs.readFileSync("/Users/binova/Documents/Projects/Suru/Owed/.env", "utf-8");
  const parsedEnv: Record<string, string> = {};
  for (const line of owedEnvContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      parsedEnv[key] = val;
    }
  }

  const commitSha = "9d4a0fde84eba716bc8fa71488a50d9a91e69267";
  const branch = "main";
  const deploymentId = randomUUID();

  console.log(`[Trigger Azure] Creating deployment ${deploymentId} for commit ${commitSha.slice(0, 7)}...`);

  await db.insert(deployments).values({
    id: deploymentId,
    projectId,
    commitSha,
    branch,
    status: "building",
    triggeredBy: project.ownerId,
    startedAt: new Date(),
  });

  const workflowResult = await startDeployWorkflow({
    deploymentId,
    projectId,
    repoOwner: project.githubRepoOwner,
    repoName: project.githubRepoName,
    commitSha,
    branch,
    installationId: Number(project.githubInstallationId) || 1001,
    cloudProvider: "azure",
    cloudConnectionId: project.cloudConnectionId || undefined,
    envVars: parsedEnv,
  });

  if (workflowResult?.workflowId) {
    console.log(`[Trigger Azure] Temporal workflow started: ${workflowResult.workflowId}`);
    await db
      .update(deployments)
      .set({ temporalWorkflowId: workflowResult.workflowId })
      .where(eq(deployments.id, deploymentId));
  }

  console.log(`[Trigger Azure] Deployment successfully initiated!`);
  console.log(`Deployment ID: ${deploymentId}`);
  console.log(`Dashboard URL: http://localhost:3000/dashboard/projects/${projectId}/deployments/${deploymentId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Trigger error:", err);
  process.exit(1);
});
