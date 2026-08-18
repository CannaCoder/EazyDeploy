import type { ServiceType } from "@shipora/types";

export interface ActivityResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DetectedServiceManifest {
  name: string;
  type: ServiceType;
  rootPath: string;
  port?: number;
  buildCommand?: string;
  envVars: string[];
}

export interface ServiceManifest {
  services: DetectedServiceManifest[];
  detectedEnvVars: string[];
  repoFilesCount: number;
}

export interface ConflictGuardActivityInput {
  projectId: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  installationId: number;
}

export interface ConflictingFile {
  file: string;
  lines: number[];
}

export interface ScanMergeConflictsResult {
  passed: boolean;
  conflictingFiles: ConflictingFile[];
}

export interface ScanLockfileHealthResult {
  passed: boolean;
  issues: string[];
}

export interface ValidateEnvVarsResult {
  passed: boolean;
  missing: string[];
  detected: string[];
  existingSecrets: string[];
}

export interface ReportGitHubStatusInput {
  repoOwner: string;
  repoName: string;
  commitSha: string;
  state: "pending" | "success" | "failure" | "error";
  description: string;
  targetUrl?: string;
  installationId: number;
}

export interface ReportGitHubStatusResult {
  success: boolean;
  statusId?: number;
}
