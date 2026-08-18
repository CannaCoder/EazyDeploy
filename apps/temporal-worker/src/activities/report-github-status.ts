import { getInstallationOctokit } from "@shipora/github-app";
import type {
  ReportGitHubStatusInput,
  ReportGitHubStatusResult,
} from "@shipora/temporal-workflows";

/**
 * Activity: reportGitHubStatusActivity
 * Posts commit status checks to GitHub (`shipora/conflict-guard`) with state:
 * - `pending`: Workflow started / checks in progress
 * - `success`: All checks passed
 * - `failure`: One or more pre-deploy checks failed
 * - `error`: Pipeline encountered unexpected exception
 */
export async function reportGitHubStatusActivity(
  input: ReportGitHubStatusInput
): Promise<ReportGitHubStatusResult> {
  const octokit = await getInstallationOctokit(input.installationId);

  if (!octokit) {
    console.warn(`[reportGitHubStatusActivity] GitHub App Octokit not configured (dev mode).`);
    return { success: true };
  }

  try {
    const response = await octokit.rest.repos.createCommitStatus({
      owner: input.repoOwner,
      repo: input.repoName,
      sha: input.commitSha,
      state: input.state,
      context: "shipora/conflict-guard",
      description: input.description,
      target_url: input.targetUrl,
    });

    return {
      success: true,
      statusId: response.data.id,
    };
  } catch (err: unknown) {
    console.warn(
      `[reportGitHubStatusActivity] Failed to post commit status to GitHub for ${input.repoOwner}/${input.repoName}@${input.commitSha}:`,
      (err as Error).message
    );
    // Return gracefully so activity failure doesn't break the entire workflow
    return {
      success: false,
    };
  }
}
