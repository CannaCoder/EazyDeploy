import type { LockfileScanResult, RepoFile } from "../types.js";

/**
 * Scans lockfiles for existence and health/consistency against package manifests.
 */
export function scanLockfileHealth(files: RepoFile[]): LockfileScanResult {
  const filePaths = files.map((f) => f.path);
  const fileMap = new Map<string, string | undefined>();
  for (const f of files) {
    if (f.content) fileMap.set(f.path, f.content);
  }

  const issues: string[] = [];

  const hasPackageJson = filePaths.some((p) => p.endsWith("package.json"));
  const hasPnpmLock = filePaths.some((p) => p.endsWith("pnpm-lock.yaml"));
  const hasNpmLock = filePaths.some((p) => p.endsWith("package-lock.json"));
  const hasYarnLock = filePaths.some((p) => p.endsWith("yarn.lock"));
  const hasBunLock = filePaths.some((p) => p.endsWith("bun.lockb"));

  let lockfileType: LockfileScanResult["lockfileType"] = "none";

  if (hasPnpmLock) lockfileType = "pnpm";
  else if (hasNpmLock) lockfileType = "npm";
  else if (hasYarnLock) lockfileType = "yarn";
  else if (hasBunLock) lockfileType = "bun";

  if (hasPackageJson) {
    if (lockfileType === "none") {
      issues.push("Missing lockfile: Repository has package.json but no pnpm-lock.yaml, package-lock.json, or yarn.lock");
    } else {
      // Check root package.json vs lockfile content if available
      const rootPkgJsonStr = fileMap.get("package.json");
      if (rootPkgJsonStr) {
        try {
          const pkg = JSON.parse(rootPkgJsonStr) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const allDeps = Object.keys({
            ...pkg.dependencies,
            ...pkg.devDependencies,
          });

          const lockfileContent =
            fileMap.get("pnpm-lock.yaml") ||
            fileMap.get("package-lock.json") ||
            fileMap.get("yarn.lock") ||
            "";

          if (lockfileContent) {
            for (const dep of allDeps) {
              // Ignore local workspace dependencies
              if (pkg.dependencies?.[dep]?.startsWith("workspace:") || pkg.devDependencies?.[dep]?.startsWith("workspace:")) {
                continue;
              }
              // Check if dependency key appears in lockfile
              if (!lockfileContent.includes(dep)) {
                issues.push(`Package '${dep}' is defined in package.json but missing from lockfile (${lockfileType})`);
              }
            }
          }
        } catch {
          issues.push("Failed to parse package.json during lockfile validation");
        }
      }
    }
  }

  // Check Python requirements / poetry
  const hasPyproject = filePaths.some((p) => p.endsWith("pyproject.toml"));
  const hasPoetryLock = filePaths.some((p) => p.endsWith("poetry.lock"));
  if (hasPyproject && !hasPoetryLock && !filePaths.some((p) => p.endsWith("requirements.txt"))) {
    // Note: not strictly an issue unless specified, but we can flag missing lockfile
    lockfileType = "poetry";
  }

  return {
    isHealthy: issues.length === 0,
    issues,
    lockfileType,
  };
}
