import type {
  ConflictGuardActivityInput,
  ServiceManifest,
  ScanMergeConflictsResult,
  ScanLockfileHealthResult,
  ValidateEnvVarsResult,
  ReportGitHubStatusInput,
  ReportGitHubStatusResult,
} from "./types.js";

export interface ConflictGuardActivities {
  analyzeRepoActivity(input: ConflictGuardActivityInput): Promise<ServiceManifest>;
  scanMergeConflictsActivity(input: ConflictGuardActivityInput): Promise<ScanMergeConflictsResult>;
  scanLockfileHealthActivity(input: ConflictGuardActivityInput): Promise<ScanLockfileHealthResult>;
  validateEnvVarsActivity(
    input: ConflictGuardActivityInput,
    detectedVars: string[]
  ): Promise<ValidateEnvVarsResult>;
  reportGitHubStatusActivity(input: ReportGitHubStatusInput): Promise<ReportGitHubStatusResult>;
}
