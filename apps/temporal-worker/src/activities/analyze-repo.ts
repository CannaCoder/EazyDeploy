import { getInstallationOctokit } from "@shipora/github-app";
import { analyzeRepository, type RepoFile } from "@shipora/code-analyzer";
import type {
  ConflictGuardActivityInput,
  ServiceManifest,
  DetectedServiceManifest,
} from "@shipora/temporal-workflows";

/**
 * Activity: analyzeRepoActivity
 * Fetches repository structure and file contents via GitHub App Octokit,
 * and runs static analysis to extract service topology and environment dependencies.
 */
export async function analyzeRepoActivity(
  input: ConflictGuardActivityInput
): Promise<ServiceManifest> {
  const octokit = await getInstallationOctokit(input.installationId);

  // 1. Fetch git tree recursively for the commit
  let treeItems: { path?: string; sha?: string; type?: string; size?: number }[] = [];

  if (octokit) {
    try {
      const treeResponse = await octokit.rest.git.getTree({
        owner: input.repoOwner,
        repo: input.repoName,
        tree_sha: input.commitSha,
        recursive: "true",
      });
      treeItems = treeResponse.data.tree;
    } catch (err: unknown) {
      console.warn(`[analyzeRepoActivity] Could not fetch tree from GitHub for ${input.repoOwner}/${input.repoName}:`, (err as Error).message);
    }
  }

  // If no tree items (mock/dev fallback)
  if (treeItems.length === 0) {
    return {
      services: [
        {
          name: "web",
          type: "nextjs",
          rootPath: "apps/web",
          port: 3000,
          buildCommand: "pnpm --filter web build",
          envVars: ["NEXT_PUBLIC_API_URL"],
        },
        {
          name: "api",
          type: "node",
          rootPath: "apps/api",
          port: 4000,
          buildCommand: "pnpm --filter api build",
          envVars: ["DATABASE_URL", "CLERK_SECRET_KEY"],
        },
      ],
      detectedEnvVars: ["NEXT_PUBLIC_API_URL", "DATABASE_URL", "CLERK_SECRET_KEY"],
      repoFilesCount: 2,
    };
  }

  // Filter text-based files relevant for inspection (skip binaries, node_modules, .git)
  const candidateFiles = treeItems.filter((item) => {
    if (item.type !== "blob" || !item.path) return false;
    const p = item.path.toLowerCase();
    return (
      !p.includes("node_modules/") &&
      !p.includes(".git/") &&
      !p.endsWith(".png") &&
      !p.endsWith(".jpg") &&
      !p.endsWith(".ico") &&
      (item.size === undefined || item.size < 500_000) // max 500KB per file
    );
  });

  // Fetch content for candidate files (up to 50 files for safety)
  const repoFiles: RepoFile[] = [];
  const filesToFetch = candidateFiles.slice(0, 50);

  for (const item of filesToFetch) {
    if (!item.path || !item.sha) continue;

    try {
      if (octokit) {
        const blob = await octokit.rest.git.getBlob({
          owner: input.repoOwner,
          repo: input.repoName,
          file_sha: item.sha,
        });

        const content = Buffer.from(blob.data.content, "base64").toString("utf-8");
        repoFiles.push({
          path: item.path,
          content,
        });
      }
    } catch {
      repoFiles.push({ path: item.path });
    }
  }

  // Run code analyzer
  const analysis = await analyzeRepository(repoFiles);

  const services: DetectedServiceManifest[] = analysis.services.map((s) => ({
    name: s.name,
    type: s.type,
    rootPath: s.rootPath,
    port: s.port,
    buildCommand: s.buildCommand,
    envVars: s.envVars,
  }));

  return {
    services,
    detectedEnvVars: analysis.detectedEnvVars,
    repoFilesCount: candidateFiles.length,
  };
}
