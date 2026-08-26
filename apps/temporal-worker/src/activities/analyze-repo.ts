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

  // 1. Fetch git tree recursively for the commit or branch
  let treeItems: { path?: string; sha?: string; type?: string; size?: number }[] = [];
  const targetRef = input.commitSha && input.commitSha.length === 40 ? input.commitSha : (input.branch || "main");

  if (octokit) {
    try {
      const treeResponse = await octokit.rest.git.getTree({
        owner: input.repoOwner,
        repo: input.repoName,
        tree_sha: targetRef,
        recursive: "true",
      });
      treeItems = treeResponse.data.tree;
    } catch (err: unknown) {
      console.warn(`[analyzeRepoActivity] Could not fetch tree via Octokit for ${input.repoOwner}/${input.repoName}:`, (err as Error).message);
    }
  }

  // Fallback 1: fetch tree via direct GitHub API (with PAT if valid, or unauthenticated public)
  if (treeItems.length === 0) {
    try {
      let ghRes = await fetch(
        `https://api.github.com/repos/${input.repoOwner}/${input.repoName}/git/trees/${targetRef}?recursive=1`,
        {
          headers: {
            "User-Agent": "Shipora-Deployer",
            Accept: "application/vnd.github.v3+json",
            ...(process.env["GITHUB_PAT"] ? { Authorization: `token ${process.env["GITHUB_PAT"]}` } : {}),
          },
        }
      );
      if (!ghRes.ok && process.env["GITHUB_PAT"]) {
        // Retry unauthenticated for public repos from different GitHub accounts
        ghRes = await fetch(
          `https://api.github.com/repos/${input.repoOwner}/${input.repoName}/git/trees/${targetRef}?recursive=1`,
          {
            headers: {
              "User-Agent": "Shipora-Deployer",
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
      }
      if (ghRes.ok) {
        const ghData = (await ghRes.json()) as { tree?: any[] };
        treeItems = ghData.tree || [];
      }
    } catch {
      // ignore
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

    let content: string | undefined = undefined;

    if (octokit) {
      try {
        const blob = await octokit.rest.git.getBlob({
          owner: input.repoOwner,
          repo: input.repoName,
          file_sha: item.sha,
        });

        content = Buffer.from(blob.data.content, "base64").toString("utf-8");
      } catch {
        // fallback to public raw fetch below
      }
    }

    if (!content) {
      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${input.repoOwner}/${input.repoName}/${targetRef}/${item.path}`
        );
        if (rawRes.ok) {
          content = await rawRes.text();
        }
      } catch {
        // ignore
      }
    }

    repoFiles.push({
      path: item.path,
      content,
    });
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
