import type { RepoFile } from "../types.js";

/**
 * Scans code files for environment variable references across:
 * - JavaScript / TypeScript: `process.env.VAR_NAME`, `process.env['VAR_NAME']`, `process.env["VAR_NAME"]`
 * - Vite: `import.meta.env.VITE_VAR`, `import.meta.env['VITE_VAR']`
 * - Python: `os.environ['VAR']`, `os.environ.get('VAR')`, `os.getenv('VAR')`
 * - Dockerfile: `ENV VAR=value`, `ENV VAR`
 */
export function detectEnvironmentVariables(files: RepoFile[]): string[] {
  const envVars = new Set<string>();

  // Standard runtime variables to exclude (framework built-ins)
  const ignoredVars = new Set([
    "NODE_ENV",
    "PORT",
    "TZ",
    "PWD",
    "HOME",
    "PATH",
    "USER",
    "SHELL",
    "TERM",
    "npm_lifecycle_event",
  ]);

  const jsProcessDotRegex = /process\.env\.([A-Z0-9_]+)/g;
  const jsProcessBracketRegex = /process\.env\[["']([A-Z0-9_]+)["']\]/g;
  const viteMetaDotRegex = /import\.meta\.env\.([A-Z0-9_]+)/g;
  const viteMetaBracketRegex = /import\.meta\.env\[["']([A-Z0-9_]+)["']\]/g;
  const pythonOsEnvironRegex = /os\.environ(?:\[["']([A-Z0-9_]+)["']\]|\.get\(["']([A-Z0-9_]+)["']\))/g;
  const pythonOsGetenvRegex = /os\.getenv\(["']([A-Z0-9_]+)["']\)/g;
  const dockerEnvRegex = /^\s*ENV\s+([A-Z0-9_]+)(?:=|\s)/gm;

  for (const file of files) {
    if (!file.content) continue;
    const content = file.content;
    const path = file.path.toLowerCase();

    // Skip node_modules, lockfiles, hidden directories, etc.
    if (
      path.includes("node_modules/") ||
      path.includes(".git/") ||
      path.endsWith(".lock") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".ico")
    ) {
      continue;
    }

    // JS/TS files
    if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx") || path.endsWith(".mjs") || path.endsWith(".cjs")) {
      let match;
      while ((match = jsProcessDotRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
      while ((match = jsProcessBracketRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
      while ((match = viteMetaDotRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
      while ((match = viteMetaBracketRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
    }

    // Python files
    if (path.endsWith(".py")) {
      let match;
      while ((match = pythonOsEnvironRegex.exec(content)) !== null) {
        const varName = match[1] || match[2];
        if (varName && !ignoredVars.has(varName)) envVars.add(varName);
      }
      while ((match = pythonOsGetenvRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
    }

    // Dockerfiles
    if (path.endsWith("dockerfile") || path.includes("dockerfile.")) {
      let match;
      while ((match = dockerEnvRegex.exec(content)) !== null) {
        if (match[1] && !ignoredVars.has(match[1])) envVars.add(match[1]);
      }
    }
  }

  return Array.from(envVars).sort();
}
