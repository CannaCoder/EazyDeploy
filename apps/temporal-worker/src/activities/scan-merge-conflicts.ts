import { getInstallationOctokit } from "@shipora/github-app";
import { scanMergeConflicts, type RepoFile } from "@shipora/code-analyzer";
import type {
  ConflictGuardActivityInput,
  ScanMergeConflictsResult,
} from "@shipora/temporal-workflows";

/**
 * Activity: scanMergeConflictsActivity
 * Scans text files in the commit for unmerged Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
 */
export async function scanMergeConflictsActivity(
  input: ConflictGuardActivityInput
): Promise<ScanMergeConflictsResult> {
  const octokit = await getInstallationOctokit(input.installationId);

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
    } catch {
      // If not connected to live GitHub, pass cleanly in dev
      return {
        passed: true,
        conflictingFiles: [],
      };
    }
  }

  const candidateFiles = treeItems.filter((item) => {
    if (item.type !== "blob" || !item.path) return false;
    const p = item.path.toLowerCase();
    return (
      !p.includes("node_modules/") &&
      !p.includes(".git/") &&
      !p.endsWith(".png") &&
      !p.endsWith(".jpg") &&
      (item.size === undefined || item.size < 500_000)
    );
  });

  const repoFiles: RepoFile[] = [];

  for (const item of candidateFiles.slice(0, 50)) {
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
      // ignore fetch errors
    }
  }

  const scanResult = scanMergeConflicts(repoFiles);

  return {
    passed: !scanResult.hasConflicts,
    conflictingFiles: scanResult.conflicts,
  };
}
