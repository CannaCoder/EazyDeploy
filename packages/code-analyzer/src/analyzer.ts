import type { AnalysisResult, RepoFile } from "./types.js";
import { detectServices } from "./detectors/framework.js";
import { detectEnvironmentVariables } from "./detectors/env.js";
import { scanMergeConflicts } from "./scanners/merge-conflicts.js";
import { scanLockfileHealth } from "./scanners/lockfile.js";

/**
 * High-level repository analyzer that combines framework detection,
 * environment variable detection, merge conflict scanning, and lockfile validation.
 */
export async function analyzeRepository(files: (string | RepoFile)[]): Promise<AnalysisResult> {
  const structuredFiles: RepoFile[] = files.map((f) =>
    typeof f === "string" ? { path: f } : f
  );

  const services = detectServices(structuredFiles);
  const detectedEnvVars = detectEnvironmentVariables(structuredFiles);
  const conflictScan = scanMergeConflicts(structuredFiles);
  const lockfileScan = scanLockfileHealth(structuredFiles);

  // Assign detected env vars per service if root path matches
  for (const service of services) {
    const serviceFiles = structuredFiles.filter((f) =>
      service.rootPath === "." ? true : f.path.startsWith(service.rootPath + "/")
    );
    service.envVars = detectEnvironmentVariables(serviceFiles);
  }

  return {
    services,
    detectedEnvVars,
    hasMergeConflicts: conflictScan.hasConflicts,
    conflictingFiles: conflictScan.conflicts,
    isLockfileHealthy: lockfileScan.isHealthy,
    lockfileIssues: lockfileScan.issues,
  };
}
