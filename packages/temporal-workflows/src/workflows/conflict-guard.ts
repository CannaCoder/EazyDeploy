import {
  proxyActivities,
  defineQuery,
  setHandler,
} from "@temporalio/workflow";
import type {
  ConflictGuardActivities,
} from "../activities/conflict-guard-activities.js";
import type {
  ServiceManifest,
  ScanMergeConflictsResult,
  ScanLockfileHealthResult,
  ValidateEnvVarsResult,
} from "../activities/types.js";

export interface ConflictGuardWorkflowInput {
  projectId: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  installationId: number;
  dashboardUrl?: string;
}

export interface ConflictGuardWorkflowResult {
  passed: boolean;
  mergeConflicts: boolean;
  lockfileHealthy: boolean;
  envVarsValid: boolean;
  summary: string;
  manifest?: ServiceManifest;
  mergeConflictDetails?: ScanMergeConflictsResult;
  lockfileDetails?: ScanLockfileHealthResult;
  envVarDetails?: ValidateEnvVarsResult;
}

export interface ConflictGuardProgress {
  stage: "initializing" | "analyzing" | "scanning" | "validating_env" | "reporting" | "completed" | "failed";
  percent: number;
  currentCheck?: string;
  passed?: boolean;
}

export const getProgressQuery = defineQuery<ConflictGuardProgress>("getProgress");

const {
  analyzeRepoActivity,
  scanMergeConflictsActivity,
  scanLockfileHealthActivity,
  validateEnvVarsActivity,
  reportGitHubStatusActivity,
} = proxyActivities<ConflictGuardActivities>({
  startToCloseTimeout: "3 minutes",
  retry: {
    initialInterval: "2s",
    maximumInterval: "30s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function conflictGuardWorkflow(
  input: ConflictGuardWorkflowInput
): Promise<ConflictGuardWorkflowResult> {
  let progress: ConflictGuardProgress = {
    stage: "initializing",
    percent: 5,
    currentCheck: "Starting Conflict Guard workflow",
  };

  setHandler(getProgressQuery, () => progress);

  const targetUrl = input.dashboardUrl || `https://app.shipora.dev/dashboard/projects/${input.projectId}/checks/${input.commitSha}`;

  // 1. Initial status check: Pending
  try {
    await reportGitHubStatusActivity({
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      installationId: input.installationId,
      state: "pending",
      description: "Shipora Conflict Guard is analyzing repository & safety...",
      targetUrl,
    });
  } catch {
    // Non-fatal if initial status post fails
  }

  progress = {
    stage: "analyzing",
    percent: 25,
    currentCheck: "Analyzing repository structure and dependencies",
  };

  // 2. Run repository analysis, conflict scanning, and lockfile checking in parallel
  const [manifestResult, mergeResult, lockfileResult] = await Promise.all([
    analyzeRepoActivity(input),
    scanMergeConflictsActivity(input),
    scanLockfileHealthActivity(input),
  ]);

  progress = {
    stage: "validating_env",
    percent: 70,
    currentCheck: "Validating environment variable keys against Secrets Manager",
  };

  // 3. Validate env vars based on detected variables
  const envResult = await validateEnvVarsActivity(input, manifestResult.detectedEnvVars);

  // 4. Aggregate outcomes
  const hasMergeConflicts = !mergeResult.passed;
  const isLockfileHealthy = lockfileResult.passed;
  const areEnvVarsValid = envResult.passed;

  const passed = !hasMergeConflicts && isLockfileHealthy && areEnvVarsValid;

  // 5. Construct summary message
  const failureReasons: string[] = [];
  if (hasMergeConflicts) {
    failureReasons.push(`${mergeResult.conflictingFiles.length} file(s) contain git merge conflicts`);
  }
  if (!isLockfileHealthy) {
    failureReasons.push(`Lockfile inconsistent (${lockfileResult.issues.length} issues)`);
  }
  if (!areEnvVarsValid) {
    failureReasons.push(`Missing ${envResult.missing.length} required environment variables`);
  }

  const summary = passed
    ? `All pre-deploy checks passed: 0 conflicts, lockfile healthy, ${manifestResult.services.length} services ready`
    : `Conflict Guard check failed: ${failureReasons.join("; ")}`;

  progress = {
    stage: "reporting",
    percent: 90,
    currentCheck: "Reporting final status to GitHub",
  };

  // 6. Post final commit status to GitHub
  await reportGitHubStatusActivity({
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    commitSha: input.commitSha,
    installationId: input.installationId,
    state: passed ? "success" : "failure",
    description: summary.slice(0, 140), // GitHub status description limit
    targetUrl,
  });

  progress = {
    stage: "completed",
    percent: 100,
    currentCheck: "Completed",
    passed,
  };

  return {
    passed,
    mergeConflicts: hasMergeConflicts,
    lockfileHealthy: isLockfileHealthy,
    envVarsValid: areEnvVarsValid,
    summary,
    manifest: manifestResult,
    mergeConflictDetails: mergeResult,
    lockfileDetails: lockfileResult,
    envVarDetails: envResult,
  };
}
