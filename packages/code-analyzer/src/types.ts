import type { ServiceType } from "@shipora/types";

export interface RepoFile {
  path: string;
  content?: string;
}

export interface DetectedService {
  name: string;
  type: ServiceType;
  rootPath: string;
  port?: number;
  buildCommand?: string;
  envVars: string[];
}

export interface ConflictingFileScan {
  file: string;
  lines: number[];
}

export interface MergeConflictScanResult {
  hasConflicts: boolean;
  conflicts: ConflictingFileScan[];
}

export interface LockfileScanResult {
  isHealthy: boolean;
  issues: string[];
  lockfileType?: "pnpm" | "npm" | "yarn" | "bun" | "pip" | "poetry" | "none";
}

export interface AnalysisResult {
  services: DetectedService[];
  detectedEnvVars: string[];
  hasMergeConflicts: boolean;
  conflictingFiles: ConflictingFileScan[];
  isLockfileHealthy: boolean;
  lockfileIssues: string[];
}
